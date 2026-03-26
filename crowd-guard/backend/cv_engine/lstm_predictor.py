"""
LSTM Crowd Density Predictor
=============================
Trains a lightweight LSTM on rolling zone density history.
Predicts density for the next N minutes per zone.

In production: retrain periodically on real historical data.
For demo: trains on synthetic data that matches realistic crowd patterns.
"""

import numpy as np
import asyncio
from datetime import datetime
from typing import Dict, List
from collections import deque

# ── Try importing TensorFlow/Keras ───────────────────────────────────────────
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.optimizers import Adam
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️  TensorFlow not installed. Run: pip install tensorflow")


# ════════════════════════════════════════════════════════════════════════════
# LSTM MODEL BUILDER
# ════════════════════════════════════════════════════════════════════════════
def build_lstm(seq_len: int = 20, n_features: int = 1) -> "Sequential":
    model = Sequential([
        LSTM(64, input_shape=(seq_len, n_features), return_sequences=True),
        Dropout(0.2),
        LSTM(32),
        Dropout(0.2),
        Dense(16, activation='relu'),
        Dense(1),                      # predict next density value
    ])
    model.compile(optimizer=Adam(0.001), loss='mse', metrics=['mae'])
    return model


# ════════════════════════════════════════════════════════════════════════════
# SYNTHETIC TRAINING DATA GENERATOR
# ════════════════════════════════════════════════════════════════════════════
def generate_training_data(n_samples: int = 2000, seq_len: int = 20):
    """
    Generate synthetic crowd density time-series data.
    Mimics real-world patterns: morning ramp, afternoon peak, evening drop.
    """
    data = []
    t = np.linspace(0, 4 * np.pi, n_samples)

    # Realistic crowd pattern: daily sinusoidal + noise + spikes
    base    = 50 + 30 * np.sin(t) + 10 * np.sin(3 * t)
    noise   = np.random.normal(0, 5, n_samples)
    spikes  = np.where(np.random.rand(n_samples) > 0.97, np.random.uniform(20, 40, n_samples), 0)
    series  = np.clip(base + noise + spikes, 0, 100)

    X, y = [], []
    for i in range(len(series) - seq_len - 1):
        X.append(series[i:i+seq_len])
        y.append(series[i+seq_len])

    X = np.array(X).reshape(-1, seq_len, 1) / 100.0   # normalize to [0,1]
    y = np.array(y) / 100.0
    return X, y


# ════════════════════════════════════════════════════════════════════════════
# PREDICTOR  (one per zone)
# ════════════════════════════════════════════════════════════════════════════
class ZonePredictor:
    SEQ_LEN = 20

    def __init__(self, zone_id: str):
        self.zone_id  = zone_id
        self.history  = deque(maxlen=self.SEQ_LEN)
        self.model    = None
        self.trained  = False

    def train(self):
        if not TF_AVAILABLE:
            return
        X, y    = generate_training_data()
        model   = build_lstm(self.SEQ_LEN)
        model.fit(X, y, epochs=10, batch_size=64, verbose=0, validation_split=0.1)
        self.model   = model
        self.trained = True
        print(f"✅ LSTM trained for Zone {self.zone_id}")

    def update(self, density_pct: float):
        self.history.append(density_pct)

    def predict_next(self, steps: int = 5) -> List[float]:
        """Predict density for next `steps` ticks (each tick = 2s, so steps=5 → 10s)."""
        if not self.trained or len(self.history) < self.SEQ_LEN:
            # Fallback: linear extrapolation
            if len(self.history) < 2:
                return [self.history[-1] if self.history else 50.0] * steps
            recent = list(self.history)[-5:]
            trend  = (recent[-1] - recent[0]) / max(len(recent)-1, 1)
            last   = recent[-1]
            return [round(min(100, max(0, last + trend * (i+1))), 1) for i in range(steps)]

        seq = np.array(list(self.history)[-self.SEQ_LEN:]).reshape(1, self.SEQ_LEN, 1) / 100.0
        preds = []
        current_seq = seq.copy()
        for _ in range(steps):
            next_val = float(self.model.predict(current_seq, verbose=0)[0][0]) * 100
            next_val = round(min(100, max(0, next_val)), 1)
            preds.append(next_val)
            # Roll sequence forward
            current_seq = np.roll(current_seq, -1, axis=1)
            current_seq[0, -1, 0] = next_val / 100.0
        return preds

    def confidence(self) -> float:
        """
        Return model confidence (0-100%) based on three factors:
          1. Whether the LSTM is trained at all (base score)
          2. How much recent history we have (data sufficiency)
          3. How stable/predictable the recent density trend is (variance penalty)
        """
        if not self.trained:
            # Fallback linear extrapolation — low but honest confidence
            return round(min(60.0, 40.0 + len(self.history) * 1.0), 1)

        history_len = len(self.history)

        # Need at least SEQ_LEN points for a full LSTM pass
        data_score = min(1.0, history_len / self.SEQ_LEN)  # 0.0 -> 1.0

        # Penalise high variance in recent readings (erratic crowd = harder to predict)
        if history_len >= 5:
            recent = list(self.history)[-5:]
            std = float(np.std(recent))
            # std ~0 -> no penalty; std ~20+ -> heavy penalty
            variance_penalty = min(20.0, std * 0.8)
        else:
            variance_penalty = 10.0  # unknown variance — apply moderate penalty

        base = 75.0
        confidence = base + (data_score * 15.0) - variance_penalty
        return round(min(95.0, max(45.0, confidence)), 1)


# ════════════════════════════════════════════════════════════════════════════
# PREDICTION ENGINE  (manages all zone predictors)
# ════════════════════════════════════════════════════════════════════════════
class PredictionEngine:
    # Default zone IDs — extended dynamically at runtime via register_zone()
    ZONE_IDS = ["A", "B", "C", "D", "E", "F"]

    # Each tick = 2s. Steps mapped to real time:
    #   30  steps =  1 min
    #   150 steps =  5 min
    #   300 steps = 10 min
    #   450 steps = 15 min
    HORIZON_STEPS = 450   # 15-minute lookahead

    def __init__(self):
        self.predictors: Dict[str, ZonePredictor] = {
            zid: ZonePredictor(zid) for zid in self.ZONE_IDS
        }
        self.predictions: Dict[str, dict] = {}

    def register_zone(self, zone_id: str):
        """Dynamically add a predictor for a new zone."""
        if zone_id not in self.predictors:
            self.predictors[zone_id] = ZonePredictor(zone_id)
            import threading
            t = threading.Thread(target=self.predictors[zone_id].train, daemon=True)
            t.start()
            print(f"✅ LSTM predictor registered for new Zone {zone_id}")

    def train_all(self):
        """Train LSTM for each zone (runs once on startup in a thread)."""
        import threading
        def _train():
            for zid, predictor in self.predictors.items():
                predictor.train()
        t = threading.Thread(target=_train, daemon=True)
        t.start()

    def update_zone(self, zone_id: str, density_pct: float):
        # Auto-register if a new zone appears at runtime
        if zone_id not in self.predictors:
            self.register_zone(zone_id)
        self.predictors[zone_id].update(density_pct)

    def get_predictions(self, zone_id: str) -> dict:
        """
        Predict density up to 15 minutes ahead.
        Returns key milestones: 1min, 5min, 10min, 15min.
        Each tick = 2s, so:
          30 steps = 1 min | 150 = 5 min | 300 = 10 min | 450 = 15 min
        """
        predictor = self.predictors.get(zone_id)
        if not predictor:
            return {}
        preds = predictor.predict_next(steps=self.HORIZON_STEPS)
        if not preds:
            return {}

        def at(step): return preds[step - 1] if len(preds) >= step else None

        return {
            "zone_id":        zone_id,
            "next_1min":      at(30),
            "next_5min":      at(150),
            "next_10min":     at(300),
            "next_15min":     at(450),
            "confidence":     predictor.confidence(),
            "will_exceed_80": any(p >= 80 for p in preds),
            "will_exceed_60": any(p >= 60 for p in preds),
            # Minutes until critical — None if never predicted to hit 80%
            "eta_critical":   next((round(i * 2 / 60, 1) for i, p in enumerate(preds) if p >= 80), None),
            "predicted_at":   datetime.utcnow().isoformat(),
        }

    def all_predictions(self) -> List[dict]:
        return [self.get_predictions(zid) for zid in self.predictors]


# ── Singleton ─────────────────────────────────────────────────────────────
prediction_engine = PredictionEngine()
