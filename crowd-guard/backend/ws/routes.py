from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json, asyncio
from typing import Set
from cv_engine.engine import set_broadcast

router = APIRouter()

# Connection manager
class WSManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        print(f"WS client connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        print(f"WS client disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)

manager = WSManager()
set_broadcast(manager.broadcast)   # plug into CV engine

@router.websocket("/live")
async def ws_live(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Use receive() instead of receive_text() to handle
            # both text pings and unexpected binary frames safely
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(ws)
