# CrisisConnect — Emergency Assistance & Disaster Coordination Platform

CrisisConnect is a full-stack, real-time emergency coordination platform designed for rapid crisis response. It pairs a **1-tap citizen SOS interface** with an **NGO dispatch & triage mission control**, an **in-browser Tesseract OCR prescription verification engine**, **MapLibre GL JS vector maps with OSRM road shortest-path navigation**, **blood donor compatibility matching**, and a **high-concurrency FastAPI + PostgreSQL (Supabase) backend** with native WebSockets.

---

## 🌟 Key Capabilities

### 🚨 Citizen Emergency Reporting (Web PWA)
- **1-Tap Master Distress Beacon & Critical SOS**: Instant 1-tap dispatch with browser GPS capture (`Fire`, `Flood`, `Earthquake`, `Accident`, `Rescue / Trapped`), grouping into real-time incidents with timeline tracking.
- **Structured Non-Critical Assistance**: Category-specific request flow for `Blood`, `Oxygen`, `Medicine`, `Food & Water`, `Shelter`, and `Transport`.
- **In-Browser Tesseract OCR Verification**: Zero-server prescription scanning for oxygen and medicine requests with confidence scoring, doctor info extraction, and medicine auto-parsing.
- **Voice Note Recording**: Web Audio voice memos attached directly to emergency requests.
- **Live Status Tracker & Road Routing**: MapLibre GL JS live tracking map displaying shortest road paths via OSRM, assigned responder cards, Web Audio emergency chimes, and live responder chat.

### 🛡️ Mission Control & NGO Dispatch
- **Urgency & Recency Triage Queue**: Real-time triage with life-threatening priority badges, blood group requirements, OCR verification tags, voice note audio player, and instant triage actions (`Approve`, `Reject`, `Flag`, `Expire`).
- **Interactive GIS Hazard Map**: MapLibre GL JS vector map plotting emergency pins, NDMA Sachet hazard polygons, confirmed crisis perimeters, and 1-tap map accept.
- **Multi-Step 2FA Authentication & Dummy Accounts**: Quick role-based login (`Volunteer` vs `NGO Agency`) with 2FA OTP simulation, registration, and persistent session state.

### ⚡ Volunteer & Blood Donor Simulation
- **Multi-Profile Radar**: Switch between Universal Donors (`O-`, `A+`, `B+`) and NGO Response Units (`Red Cross Mumbai`).
- **Blood Compatibility Matching**: Real-time recipient/donor compatibility matrix (`O-` universal, `AB+` universal recipient).
- **Atomic Concurrency Protection**: High-concurrency first-accept-wins locks preventing double-assignment races (`409 Conflict Guard`).

### ⚙️ Production-Grade Backend Engine
- **FastAPI + asyncpg + PostgreSQL (Supabase)**: Modular router architecture with connection pooling and PostgreSQL extensions (`cube`, `earthdistance`).
- **Automated 3-Stage Verification Pipeline**: Rule-based verification on request creation (`Duplicate check` ➔ `Completeness check` ➔ `Evidence / Phone / Video check`).
- **Dual WebSocket Protocol**: Supports both multiplexed (`/ws?channels=...`) and path-based (`/ws/{channel_type}/{channel_id}`) clients with dual-key JSON envelopes (`payload` + `data`).
- **Background Stale Request Expiry**: Automatic sweep marking unmatched requests as expired after 45 minutes.

---

## 🛠️ Architecture & Project Structure

```
Crisis-Connect/
├── backend/
│   ├── main.py                 # Root FastAPI entrypoint (uvicorn main:app)
│   ├── schema.sql              # PostgreSQL DDL schema with extensions & indexes
│   ├── requirements.txt        # Python backend dependencies
│   ├── test_backend.py         # End-to-end API & concurrency test suite
│   ├── app/                    # Modular FastAPI core
│   │   ├── config.py           # Environment variables & constants
│   │   ├── db.py               # asyncpg database connection pool
│   │   ├── schemas.py          # Pydantic validation models & field aliases
│   │   ├── verification.py     # 3-stage verification pipeline
│   │   ├── incident_status.py  # Monotonic incident status advancement
│   │   ├── blood.py            # Blood donor compatibility matrix
│   │   ├── expiry.py           # Background sweep for stale requests
│   │   ├── ws.py               # High-concurrency WebSocket ConnectionManager
│   │   ├── auth.py             # JWT issuance & validation
│   │   ├── demo_seed.py        # Mumbai disaster scenario seeder
│   │   └── routers/            # Modular endpoint routers
│   │       ├── requests.py     # Requests CRUD, enrich, atomic accept, blood matching
│   │       ├── auth.py         # 2FA OTP, login, helper registration
│   │       ├── sos.py          # 1-tap SOS distress beacon
│   │       ├── incidents.py    # Incident clustering, timeline, assessment
│   │       ├── matches.py      # Match status transitions
│   │       ├── messages.py     # Direct match chat messages
│   │       ├── zones.py        # Public zone reports & NDMA Sachet alerts
│   │       └── helpers.py      # Helper profile & availability management
│   └── tests/                  # Complete pytest & concurrency race test suites
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx             # Main application shell with mode switching
│       ├── index.css           # Mission control daylight styling & animations
│       ├── services/
│       │   ├── api.js          # Environment-adaptive REST API client
│       │   ├── websocket.js    # Resilient auto-reconnecting WebSocket client
│       │   └── ocrService.js   # Tesseract.js client-side OCR engine
│       ├── utils/
│       │   ├── prescriptionParser.js # Doctor & prescription entity parser
│       │   ├── routeUtils.js         # OSRM road shortest route calculator
│       │   ├── audioChime.js         # Web Audio API alert chimes
│       │   ├── bloodCompatibility.js # Universal blood compatibility rules
│       │   ├── device.js             # Device UUID persistence
│       │   └── offlineSos.js         # Offline distress sync
│       └── components/
│           ├── Header.jsx            # Top callout header with role switcher
│           ├── Requester/            # InstantReport, NonCriticalModal, LiveStatusTracker, RequesterLiveMap
│           ├── Critical/             # SosButton, SosStatusView
│           ├── Admin/                # AdminDashboard, AdminMap
│           ├── Simulation/           # VolunteerMock radar & route visualizer
│           ├── Auth/                 # MultiStepAuthModal
│           └── ZoneReport/           # Public crowdsourced pin-drop
│
├── docs/                       # Complete PRDs, contracts & design specs
└── render.yaml                 # 1-Click Render cloud deployment blueprint
```

---

## 🚀 Quick Start

### 1. Database Setup (Supabase / PostgreSQL)
Execute `backend/schema.sql` in your Supabase SQL Editor or local PostgreSQL instance.

### 2. Run Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```
- API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`
- Reseed Demo Scenarios: `POST http://localhost:8000/seed`

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Verification

### Run Dev A API Test Suite:
```bash
cd backend
python test_backend.py
```

### Run Pytest Test Suite:
```bash
cd backend
PYTHONPATH=. pytest
```

### Run Concurrency & Race Condition Suite:
```bash
cd backend
bash tests/run_all.sh
```

---

## 🌐 Cloud Deployment (Render & Vercel)
- The repo includes `render.yaml` for 1-click deployment on Render (FastAPI Web Service + React Static Site).
- The frontend dynamically auto-detects `localhost`, LAN IP, or Render backend `https://crisis-connect-m6da.onrender.com`.
