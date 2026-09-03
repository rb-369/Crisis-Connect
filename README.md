# CrisisConnect — Rapid Emergency Response & Aid Coordination

A real-time emergency response platform built with **FastAPI**, **Native WebSockets**, **Supabase (PostgreSQL)**, and **React (Vite + Tailwind CSS)**.

---

## 🌟 Tech Stack

- **Backend:** FastAPI (Python), Native WebSockets, Pydantic, Uvicorn
- **Database:** Supabase (PostgreSQL with `cube` and `earthdistance` extensions)
- **Frontend:** React 18, Vite 5, Tailwind CSS 3, Lucide Icons, Leaflet GIS Maps

---

## 🚀 Key Features

1. **1-Tap Emergency Report (Requester Step 1)**:
   - 7 emergency categories (`Blood`, `Food & Water`, `Medicines`, `Oxygen Tank`, `Emergency Shelter`, `Evac Transport`, `Active Rescue`).
   - Auto-urgency promotion for Oxygen & Rescue requests.
   - Browser GPS auto-capture with manual pin-drop fallback.
2. **Optional Enrichment Form (Step 2)**:
   - Attach contact name, phone number, notes, and photo.
   - 1-click **Skip Form** button so responders are never delayed.
3. **Live Status Pipeline (Step 3)**:
   - Real-time status tracker (`Requested` ➔ `Matched` ➔ `In Progress` ➔ `Resolved`) updated via native WebSockets.
4. **Direct Responders Chat (Step 7)**:
   - In-app WebSocket chat channel for direct communication with matched volunteers.
5. **Duplicate / Linked Request Alert (Step 8)**:
   - Detects clustered emergency requests (< 300m radius) and surfaces *"N others nearby also need this"*.
6. **NGO / Dispatch Admin Dashboard**:
   - Triage queue prioritized by urgency (`HIGH URGENCY` at top) then recency.
   - Quick action buttons to `Approve`, `Flag`, or `Reject` requests.
7. **Admin Crisis GIS Map**:
   - Interactive Leaflet map displaying active category-coded pins and confirmed crisis hazard perimeters.
8. **Public Crowdsourced Hazard Pin-Drop**:
   - Public hazard reporting screen requiring zero login.
   - Automatic 3-report cluster threshold detection declaring a confirmed crisis zone.
9. **Volunteer Mobile Simulator**:
   - In-app simulator for testing volunteer accepts, status transitions, and two-way chat.

---

## 🛠️ Project Structure

```
Crisis-Connect/
├── backend/
│   ├── main.py                 # FastAPI app & native WebSocket handler
│   ├── config.py               # Env configuration
│   ├── database.py             # Supabase & memory database layer
│   ├── websocket_manager.py    # Channel room WebSocket manager
│   ├── schema.sql              # Shared PostgreSQL DDL schema
│   ├── test_backend.py         # Backend acceptance test suite
│   └── routers/
│       ├── requests.py         # Emergency requests CRUD
│       ├── messages.py         # Direct chat messages
│       └── zones.py            # Public zone reports & confirmed zones
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx             # Main App layout & tab routing
        ├── services/           # REST API & WebSocket clients
        ├── utils/              # Persistent device UUID helper
        └── components/         # Requester, Admin, Map, Zone & Sim components
```

---

## ⚙️ Quick Start

### 1. Database Setup (Supabase)
Run the SQL DDL script in `backend/schema.sql` inside your **Supabase SQL Editor**.

### 2. Environment Variables
Create a `.env` file in the project root or in `backend/`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
PORT=8000
```

### 3. Run Backend
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```
- API Docs: `http://localhost:8000/docs`
- Native WebSocket endpoint: `ws://localhost:8000/ws/{channel_type}/{channel_id}`

### 4. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173/` in your browser.
