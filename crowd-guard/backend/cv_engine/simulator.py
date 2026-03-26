"""
CV Engine - Simulates YOLOv8 person detection + density calculation.
In production: replace simulate_zone() with real OpenCV + YOLOv8 pipeline.
"""
import asyncio, random, math
from datetime import datetime
from typing import Dict

from models import Zone, Alert, AlertLevel

# Default zone definitions
DEFAULT_ZONES = [
    {"zone_id": "A", "name": "Entrance Plaza",  "capacity": 850, "location": "North Gate"},
    {"zone_id": "B", "name": "Main Hall",        "capacity": 850, "location": "Central"},
    {"zone_id": "C", "name": "Gate B",           "capacity": 850, "location": "East Wing"},
    {"zone_id": "D", "name": "Food Court",       "capacity": 850, "location": "South Block"},
    {"zone_id": "E", "name": "Corridor E",       "capacity": 850, "location": "West Passage"},
    {"zone_id": "F", "name": "Exit Area",        "capacity": 850, "location": "South Gate"},
]

# Broadcast function — set by WebSocket router
_broadcast_fn = None

def set_broadcast(fn):
    global _broadcast_fn
    _broadcast_fn = fn

def density_status(pct: float) -> AlertLevel:
    if pct >= 80:  return AlertLevel.critical
    if pct >= 60:  return AlertLevel.warning
    return AlertLevel.safe

class ZoneState:
    def __init__(self, zone_id: str, base_count: int, capacity: int):
        self.zone_id   = zone_id
        self.capacity  = capacity
        self.count     = base_count
        self.pct       = round(base_count / capacity * 100, 1)
        self.prev_status = density_status(self.pct)

    def tick(self):
        """Simulate crowd movement each tick"""
        # Inject realistic patterns: gate B gets busy over time
        bias = 0.3 if self.zone_id == "C" else (-0.1 if self.zone_id == "F" else 0.0)
        delta = random.gauss(bias, 3)
        self.count     = max(10, min(self.capacity, int(self.count + delta * 8)))
        self.pct       = round(self.count / self.capacity * 100, 1)

class CrowdSimulator:
    def __init__(self):
        self.states: Dict[str, ZoneState] = {}
        self.base_counts = {"A":289,"B":500,"C":550,"D":382,"E":520,"F":247}
        self.capacity = 850

    async def seed_zones(self):
        for z in DEFAULT_ZONES:
            exists = await Zone.find_one(Zone.zone_id == z["zone_id"])
            if not exists:
                await Zone(**z, count=self.base_counts[z["zone_id"]],
                           density_pct=round(self.base_counts[z["zone_id"]]/850*100,1)).insert()
            if z["zone_id"] not in self.states:
                self.states[z["zone_id"]] = ZoneState(z["zone_id"],
                    self.base_counts[z["zone_id"]], self.capacity)

    async def run(self):
        await asyncio.sleep(2)   # wait for DB
        await self.seed_zones()
        print("🤖 CV Simulator running")

        while True:
            await asyncio.sleep(2)
            payload = []
            for zid, state in self.states.items():
                state.tick()
                new_status = density_status(state.pct)

                # Persist to DB
                zone = await Zone.find_one(Zone.zone_id == zid)
                if zone:
                    zone.count       = state.count
                    zone.density_pct = state.pct
                    zone.status      = new_status
                    zone.updated_at  = datetime.utcnow()
                    await zone.save()

                # Create alert if status worsened
                if new_status != state.prev_status and new_status != AlertLevel.safe:
                    msg = (f"Zone {zid} density reached {state.pct}% — "
                           f"{'STAMPEDE RISK! Deploy emergency response.' if new_status == AlertLevel.critical else 'Approaching critical threshold. Monitor closely.'}")
                    alert = Alert(zone_id=zid, zone_name=zone.name if zone else zid,
                                  level=new_status, message=msg,
                                  density_pct=state.pct, count=state.count)
                    await alert.insert()

                state.prev_status = new_status
                payload.append({
                    "zone_id": zid,
                    "name":    zone.name if zone else zid,
                    "count":   state.count,
                    "pct":     state.pct,
                    "status":  new_status.value,
                    "capacity": state.capacity,
                })

            # Broadcast to all WS clients
            if _broadcast_fn:
                await _broadcast_fn({"type": "zone_update", "zones": payload,
                                     "ts": datetime.utcnow().isoformat()})
