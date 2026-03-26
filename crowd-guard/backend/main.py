from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from contextlib import asynccontextmanager
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()  # loads .env in local dev; on Render, env vars are set via dashboard

from auth.routes   import router as auth_router
from zones.routes  import router as zones_router
from alerts.routes import router as alerts_router
from ws.routes     import router as ws_router
from database      import connect_db, disconnect_db
from cv_engine.engine         import CVEngine
from cv_engine.lstm_predictor import prediction_engine

cv_engine = CVEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    prediction_engine.train_all()          # trains LSTM in background thread
    asyncio.create_task(cv_engine.run())   # starts CV engine loop
    yield
    await disconnect_db()

app = FastAPI(title="CrowdGuard EC-9 API", version="2.0.0", lifespan=lifespan)

# ── CORS ─────────────────────────────────────────────────────────────────────
# allow_origins=["*"] with allow_credentials=True is invalid per CORS spec.
# Use explicit frontend URL from env, fallback to wildcard (no credentials).
_frontend_url = os.getenv("FRONTEND_URL", "")
_origins = [_frontend_url] if _frontend_url else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=bool(_frontend_url),   # only True when origin is explicit
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router,   prefix="/api/auth",   tags=["auth"])
app.include_router(zones_router,  prefix="/api/zones",  tags=["zones"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])
app.include_router(ws_router,     prefix="/ws",         tags=["websocket"])

@app.get("/")
async def root():
    return {"status": "CrowdGuard EC-9 v2.0 online", "cv_engine": "YOLOv8 + LSTM"}

# ── MJPEG Live Camera Stream ──────────────────────────────────────────────────
@app.get("/api/stream/{zone_id}")
async def video_stream(zone_id: str):
    """Live annotated MJPEG feed. Frontend usage: <img src='/api/stream/A' />"""
    async def frame_gen():
        zid = zone_id.upper()
        while True:
            frame = cv_engine.get_frame(zid)
            if frame:
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
            await asyncio.sleep(0.1)
    return StreamingResponse(frame_gen(), media_type="multipart/x-mixed-replace; boundary=frame")

# ── LSTM Predictions ──────────────────────────────────────────────────────────
@app.get("/api/predictions")
async def get_predictions():
    return prediction_engine.all_predictions()

@app.get("/api/predictions/{zone_id}")
async def get_zone_prediction(zone_id: str):
    return prediction_engine.get_predictions(zone_id.upper())
