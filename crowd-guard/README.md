# 👁️ CrowdGuard EC-9 — Autonomous Crowd Density Prediction System

> Full-stack AI system for real-time crowd monitoring, density prediction, and stampede early warning.

---

## 🏗️ Architecture

```
Frontend (React + Vite)  →  Vercel
Backend  (FastAPI)        →  Render
Database (MongoDB Atlas)  →  Free tier
WebSocket (live updates)  →  Built into FastAPI
CV Engine (YOLOv8 sim)   →  Runs inside backend
```

---

## 🚀 Quick Start (Local)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt

# Copy and fill in your MongoDB Atlas URL
cp .env.example .env

uvicorn main:app --reload
# API runs at http://localhost:8000
# Docs at  http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App runs at http://localhost:5173
```

---

## ☁️ Deploy for Free

### MongoDB Atlas (Database)
1. Go to https://mongodb.com/atlas
2. Create free M0 cluster
3. Get connection string → paste in backend `.env` as `MONGO_URL`

### Render (Backend)
1. Push code to GitHub
2. New Web Service → connect repo → root dir: `backend`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env vars: `MONGO_URL`, `JWT_SECRET`, `DB_NAME`

### Vercel (Frontend)
1. New Project → connect repo → root dir: `frontend`
2. Framework: Vite
3. Add env vars:
   - `VITE_API_URL` = your Render URL
   - `VITE_WS_URL`  = your Render URL (replace https with wss)

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login`    | — | Login, get JWT |
| GET  | `/api/auth/me`       | JWT | Current user |
| GET  | `/api/zones/`        | JWT | All zones live |
| PATCH| `/api/zones/:id`     | Admin | Edit zone |
| GET  | `/api/alerts/`       | JWT | Alert history |
| GET  | `/api/alerts/stats`  | JWT | Alert counts |
| PATCH| `/api/alerts/:id/resolve` | Admin | Resolve alert |
| WS   | `/ws/live`           | — | Live zone stream |

---

## 🧠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Backend  | FastAPI, Python 3.11, Uvicorn |
| Database | MongoDB Atlas + Beanie ODM |
| Auth     | JWT (python-jose) + bcrypt |
| Realtime | WebSocket (native FastAPI) |
| CV Engine | Simulated YOLOv8 density pipeline |
| Hosting  | Vercel (frontend) + Render (backend) |

---

## 🔐 Roles

- **viewer** — Can view dashboard and alerts
- **admin** — Can edit zones and resolve alerts

---

## 📁 Project Structure

```
crowd-guard/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── database.py          # MongoDB connection
│   ├── models.py            # User, Zone, Alert schemas
│   ├── requirements.txt
│   ├── auth/routes.py       # JWT auth
│   ├── zones/routes.py      # Zone CRUD
│   ├── alerts/routes.py     # Alert history
│   ├── ws/routes.py         # WebSocket broadcast
│   └── cv_engine/simulator.py  # AI crowd engine
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── AlertsPage.jsx
    │   │   └── AdminPage.jsx
    │   ├── components/Layout.jsx
    │   ├── context/AuthContext.jsx
    │   ├── hooks/useWSLive.js
    │   └── utils/api.js
    ├── package.json
    └── vite.config.js
```

---

*EC-9 Project · SRM Valliammai Engineering College · AI & Data Science*
