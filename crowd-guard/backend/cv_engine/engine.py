"""
Real Computer Vision Engine
============================
Uses YOLOv8 for person detection on live camera/video feeds.
Falls back to simulation if no camera is available (for demo/deployment).

Pipeline:
  Camera/Video → OpenCV → YOLOv8 → Person Count → Density Calc → Alert → WebSocket
"""

import cv2
import asyncio
import threading
import numpy as np
from datetime import datetime
from typing import Dict, Optional
from pathlib import Path

from models import Zone, Alert, AlertLevel

# ── Try importing YOLOv8 ─────────────────────────────────────────────────────
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️  ultralytics not installed. Run: pip install ultralytics")

# ── Broadcast hook (set by WebSocket router) ─────────────────────────────────
_broadcast_fn = None
def set_broadcast(fn):
    global _broadcast_fn
    _broadcast_fn = fn

# ── Zone definitions ─────────────────────────────────────────────────────────
DEFAULT_ZONES = [
    {"zone_id": "A", "name": "Entrance Plaza", "capacity": 850, "location": "North Gate"},
    {"zone_id": "B", "name": "Main Hall",       "capacity": 850, "location": "Central"},
    {"zone_id": "C", "name": "Gate B",          "capacity": 850, "location": "East Wing"},
    {"zone_id": "D", "name": "Food Court",      "capacity": 850, "location": "South Block"},
    {"zone_id": "E", "name": "Corridor E",      "capacity": 850, "location": "West Passage"},
    {"zone_id": "F", "name": "Exit Area",       "capacity": 850, "location": "South Gate"},
]

# ── Camera sources (edit these to match your setup) ──────────────────────────
# 0, 1, 2 = webcam index
# "rtsp://..." = IP camera stream
# "path/to/video.mp4" = video file
CAMERA_SOURCES = {
    "A": 0,                          # Webcam 0 → Zone A
    # "B": "rtsp://192.168.1.10/stream",   # IP cam → Zone B
    # "C": "videos/gate_b.mp4",            # Video file → Zone C
}

# Zone area in m² (used for density per m² calculation)
ZONE_AREA_M2 = {
    "A": 500, "B": 500, "C": 500,
    "D": 500, "E": 500, "F": 500,
}

def density_status(pct: float) -> AlertLevel:
    if pct >= 80: return AlertLevel.critical
    if pct >= 60: return AlertLevel.warning
    return AlertLevel.safe


# ════════════════════════════════════════════════════════════════════════════
# REAL CV ZONE PROCESSOR
# ════════════════════════════════════════════════════════════════════════════
class ZoneProcessor:
    """
    Processes a single camera feed for one zone.
    Runs YOLOv8 in a background thread to avoid blocking asyncio.
    """
    def __init__(self, zone_id: str, source, capacity: int, model):
        self.zone_id  = zone_id
        self.source   = source
        self.capacity = capacity
        self.model    = model
        self.count    = 0
        self.pct      = 0.0
        self.frame    = None          # latest annotated frame (JPEG bytes)
        self._lock    = threading.Lock()
        self._running = False

    def start(self):
        self._running = True
        t = threading.Thread(target=self._loop, daemon=True)
        t.start()
        print(f"📷 Zone {self.zone_id} camera started → source: {self.source}")

    def stop(self):
        self._running = False

    def _loop(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            print(f"❌ Zone {self.zone_id}: Cannot open camera source {self.source}")
            self._running = False
            return

        cap.set(cv2.CAP_PROP_FRAME_WIDTH,  640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

        while self._running:
            ret, frame = cap.read()
            if not ret:
                # Restart video file loop
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # ── YOLOv8 Detection ────────────────────────────────────────────
            results = self.model(frame, classes=[0], verbose=False)  # class 0 = person
            detections = results[0].boxes

            person_count = len(detections)
            pct = round(min(person_count / self.capacity * 100, 100), 1)

            # ── Annotate Frame ───────────────────────────────────────────────
            annotated = frame.copy()
            for box in detections:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                color = (0, 230, 118) if pct < 60 else (0, 170, 255) if pct < 80 else (59, 59, 255)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                cv2.putText(annotated, f"{conf:.2f}", (x1, y1 - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

            # Overlay density info
            status_color = (0, 230, 118) if pct < 60 else (0, 170, 255) if pct < 80 else (59, 59, 255)
            cv2.rectangle(annotated, (0, 0), (280, 60), (0, 0, 0), -1)
            cv2.putText(annotated, f"Zone {self.zone_id}  |  {person_count} persons",
                        (8, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 210, 246), 1)
            cv2.putText(annotated, f"Density: {pct}%  [{density_status(pct).value.upper()}]",
                        (8, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 1)

            # Encode to JPEG for streaming
            _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 70])

            with self._lock:
                self.count = person_count
                self.pct   = pct
                self.frame = buf.tobytes()

        cap.release()

    def get_state(self):
        with self._lock:
            return self.count, self.pct

    def get_frame(self):
        with self._lock:
            return self.frame


# ════════════════════════════════════════════════════════════════════════════
# SIMULATION FALLBACK (for zones without a real camera)
# ════════════════════════════════════════════════════════════════════════════
import random

class SimZoneState:
    def __init__(self, zone_id: str, base_count: int, capacity: int):
        self.zone_id     = zone_id
        self.capacity    = capacity
        self.count       = base_count
        self.pct         = round(base_count / capacity * 100, 1)
        self._prev_count = base_count   # for flow direction tracking

    def tick(self):
        bias  = 0.3 if self.zone_id == "C" else (-0.1 if self.zone_id == "F" else 0.0)
        delta = random.gauss(bias, 3)
        self._prev_count = self.count
        self.count = max(10, min(self.capacity, int(self.count + delta * 8)))
        self.pct   = round(self.count / self.capacity * 100, 1)

    def flow_delta(self) -> int:
        """Net people change since last tick (+ve = influx, -ve = outflow)."""
        return self.count - self._prev_count


# ════════════════════════════════════════════════════════════════════════════
# STAMPEDE RISK SCORE  (0–100)
# ════════════════════════════════════════════════════════════════════════════
def stampede_risk_score(pct: float, flow_delta: int, predicted_pct: float) -> int:
    """
    Combines three signals into a single 0–100 stampede risk score:
      - Current density (60% weight)
      - 1-min LSTM prediction (30% weight)
      - Crowd flow direction — rapid influx is dangerous (10% weight)
    """
    density_score    = pct * 0.60
    prediction_score = predicted_pct * 0.30
    # Rapid influx (>20 people/tick) raises risk; outflow lowers it slightly
    flow_score = min(10.0, max(-5.0, flow_delta * 0.5))
    raw = density_score + prediction_score + flow_score
    return round(min(100, max(0, raw)))


# ════════════════════════════════════════════════════════════════════════════
# MAIN CV ENGINE  (orchestrates real + simulated zones)
# ════════════════════════════════════════════════════════════════════════════
class CVEngine:
    BASE_COUNTS = {"A": 289, "B": 500, "C": 550, "D": 382, "E": 520, "F": 247}

    def __init__(self):
        self.processors: Dict[str, ZoneProcessor] = {}
        self.sim_states: Dict[str, SimZoneState]  = {}
        self.prev_status: Dict[str, AlertLevel]   = {}
        self.model = None

    def _load_model(self):
        if not YOLO_AVAILABLE:
            return False
        try:
            self.model = YOLO("yolov8n.pt")   # nano — fastest, auto-downloads
            print("✅ YOLOv8n model loaded")
            return True
        except Exception as e:
            print(f"⚠️  YOLOv8 load failed: {e}")
            return False

    async def seed_zones(self):
        for z in DEFAULT_ZONES:
            exists = await Zone.find_one(Zone.zone_id == z["zone_id"])
            if not exists:
                bc = self.BASE_COUNTS.get(z["zone_id"], 200)
                await Zone(**z, count=bc, density_pct=round(bc / z["capacity"] * 100, 1)).insert()

    async def create_zone(self, zone_id: str, name: str, capacity: int, location: str):
        """Dynamically add a new zone at runtime (admin API)."""
        exists = await Zone.find_one(Zone.zone_id == zone_id)
        if exists:
            return False
        await Zone(zone_id=zone_id, name=name, capacity=capacity,
                   location=location, count=0, density_pct=0.0).insert()
        # Add simulation fallback for this zone
        self.sim_states[zone_id] = SimZoneState(zone_id, 0, capacity)
        # Register LSTM predictor
        try:
            from cv_engine.lstm_predictor import prediction_engine
            prediction_engine.register_zone(zone_id)
        except Exception:
            pass
        print(f"✅ Zone {zone_id} ({name}) added dynamically")
        return True

    def _start_cameras(self):
        """Start real camera processors for configured sources."""
        if not self.model:
            return
        for zone_id, source in CAMERA_SOURCES.items():
            proc = ZoneProcessor(zone_id, source, 850, self.model)
            proc.start()
            self.processors[zone_id] = proc

    def _ensure_sim_fallback(self):
        """Create simulation state for all zones without a real camera."""
        # Covers DEFAULT_ZONES + any dynamically added zones in sim_states
        for z in DEFAULT_ZONES:
            zid = z["zone_id"]
            if zid not in self.processors and zid not in self.sim_states:
                self.sim_states[zid] = SimZoneState(
                    zid, self.BASE_COUNTS.get(zid, 200), z["capacity"])

    async def run(self):
        await asyncio.sleep(2)
        await self.seed_zones()

        model_ok = self._load_model()
        self._start_cameras()
        self._ensure_sim_fallback()

        mode = "REAL CV" if self.processors else "SIMULATION"
        real = list(self.processors.keys())
        sim  = list(self.sim_states.keys())
        print(f"🤖 CV Engine running — mode: {mode}")
        if real: print(f"   📷 Real camera zones : {real}")
        if sim:  print(f"   🔁 Simulated zones   : {sim}")

        while True:
            await asyncio.sleep(2)
            payload = []

            # Use DB as source of truth for zone list — picks up dynamic additions
            all_zones = await Zone.find_all().to_list()

            for zone in all_zones:
                zid = zone.zone_id

                # Ensure sim fallback exists for any newly added zones
                if zid not in self.processors and zid not in self.sim_states:
                    self.sim_states[zid] = SimZoneState(zid, 0, zone.capacity)

                # Get count + pct from real CV or simulation
                if zid in self.processors:
                    count, pct = self.processors[zid].get_state()
                    flow_delta = 0   # flow tracking for real CV not yet implemented
                else:
                    self.sim_states[zid].tick()
                    count      = self.sim_states[zid].count
                    pct        = self.sim_states[zid].pct
                    flow_delta = self.sim_states[zid].flow_delta()

                # Flow direction label
                if flow_delta > 10:
                    flow_direction = "influx"
                elif flow_delta < -10:
                    flow_direction = "outflow"
                else:
                    flow_direction = "stable"

                new_status = density_status(pct)
                prev       = self.prev_status.get(zid, AlertLevel.safe)

                # Get 1-min LSTM prediction for stampede risk score
                predicted_1min = pct  # fallback = current
                try:
                    from cv_engine.lstm_predictor import prediction_engine
                    pred = prediction_engine.get_predictions(zid)
                    predicted_1min = pred.get("next_1min") or pct
                except Exception:
                    pass

                risk_score = stampede_risk_score(pct, flow_delta, predicted_1min)

                # Persist to DB
                zone.count        = count
                zone.density_pct  = pct
                zone.status       = new_status
                zone.updated_at   = datetime.utcnow()
                await zone.save()

                # Auto-generate alert on status change
                if new_status != prev and new_status != AlertLevel.safe:
                    msg = (
                        f"Zone {zid} density reached {pct}% (Risk Score: {risk_score}/100) — "
                        + ("STAMPEDE RISK! Deploy emergency response immediately."
                           if new_status == AlertLevel.critical
                           else "Approaching critical threshold. Increase monitoring.")
                    )
                    await Alert(
                        zone_id=zid,
                        zone_name=zone.name,
                        level=new_status,
                        message=msg,
                        density_pct=pct,
                        count=count,
                    ).insert()

                self.prev_status[zid] = new_status
                payload.append({
                    "zone_id":        zid,
                    "name":           zone.name,
                    "count":          count,
                    "pct":            pct,
                    "status":         new_status.value,
                    "capacity":       zone.capacity,
                    "source":         "camera" if zid in self.processors else "simulated",
                    "flow_delta":     flow_delta,
                    "flow_direction": flow_direction,
                    "risk_score":     risk_score,
                })

            if _broadcast_fn:
                await _broadcast_fn({
                    "type":  "zone_update",
                    "zones": payload,
                    "ts":    datetime.utcnow().isoformat(),
                })

            # Feed latest density into LSTM predictor
            try:
                from cv_engine.lstm_predictor import prediction_engine
                for item in payload:
                    prediction_engine.update_zone(item["zone_id"], item["pct"])
            except Exception:
                pass

    def get_frame(self, zone_id: str) -> Optional[bytes]:
        """Return latest annotated JPEG frame for a zone (for MJPEG stream)."""
        proc = self.processors.get(zone_id)
        return proc.get_frame() if proc else None
