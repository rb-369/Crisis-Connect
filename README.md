# CrisisConnect — Real-Time Emergency Coordination & Disaster Response Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Flutter](https://img.shields.io/badge/Flutter-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_15-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![MapLibre](https://img.shields.io/badge/MapLibre_GL-212121?style=for-the-badge&logo=maplibre&logoColor=white)](https://maplibre.org/)
[![WebSockets](https://img.shields.io/badge/WebSockets-Native_Async-FF6B6B?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)

CrisisConnect is a full-stack, distributed emergency coordination ecosystem designed for rapid disaster triage and humanitarian response. 

The platform bridges **on-the-ground citizens and volunteers via a Flutter Mobile App** with **NGO dispatchers, agency admins, and triage commanders via a React Web Mission Control**, powered by a **concurrency-locked FastAPI + PostgreSQL (Supabase) engine with native sub-100ms WebSockets**.

---

## 🏛️ Ecosystem Overview & Multi-Client Role Division

```
                                  ┌─────────────────────────────────────────────────────────┐
                                  │               CRISISCONNECT BACKEND ENGINE              │
                                  │   FastAPI • asyncpg • Supabase PostgreSQL • WebSockets  │
                                  │       (Atomic Concurrency Guard • Spatial Clusters)      │
                                  └────────────┬──────────────────────────────┬──────────────┘
                                               │                              │
                        ┌──────────────────────┴───────┐      ┌───────────────┴──────────────────────┐
                        │                              │      │                                      │
                        ▼                              ▼      ▼                                      ▼
        📱 FLUTTER MOBILE APP (iOS / Android)                💻 WEB MISSION CONTROL (Desktop / Tablet PWA)
        ┌──────────────────────────────────────────────┐     ┌──────────────────────────────────────────────┐
        │  TARGET: Citizens & Field Responders        │     │  TARGET: NGO Admins, Dispatchers & Commanders│
        │                                              │     │                                              │
        │  🚨 1-Tap SOS Distress Beacon (< 2s)         │     │  🛡️ Urgency/Recency Triage Queue (Moderation)│
        │  📴 Offline SOS Queuing & Auto-Sync          │     │  🗺️ GIS MapLibre Crisis Hazard Vector Map    │
        │  🎙️ Web/Native Audio Voice Memos             │     │  📈 Spatial Incident Clustering & Escalation │
        │  🚑 Live Volunteer Radar & OSRM Driving Nav  │     │  ⚠️ NDMA Sachet Disaster Alert Polygons      │
        │  🩸 Universal Blood Compatibility Radar      │     │  🔍 In-Browser Tesseract.js OCR Prescription │
        │  💬 Real-Time In-App Responder Chat          │     │  👥 Multi-Step 2FA NGO & Volunteer Onboard   │
        └──────────────────────────────────────────────┘     └──────────────────────────────────────────────┘
```

---

## 🌟 Key Architecture & Capabilities

### 📱 1. Flutter Mobile App (Citizens & Field Volunteers)
* **1-Tap Master SOS**: Sub-second GPS capture with emergency type selection (`Fire`, `Flood`, `Earthquake`, `Accident`, `Rescue / Trapped`) bypassing slow form inputs.
* **Offline-Resilient Queue**: Syncs distress signals created during total connectivity blackouts as soon as cell signal or Wi-Fi reconnects, preserving exact `client_created_at` timestamps.
* **Turn-by-Turn Driving Navigation**: Live routing with OSRM (Open Source Routing Machine) shortest-path calculations and fallback curves.
* **Live Responder Tracking & Chat**: End-to-end direct WebSocket communication between victim and assigned helper.

### 💻 2. Web Mission Control (NGOs, Admins & Command Centers)
* **Live Urgency & Recency Triage Queue**: Real-time moderation desk with life-threatening priority badges, automated verification tags, and 1-tap moderation (`Approve`, `Reject`, `Flag`, `Expire`).
* **Interactive GIS Hazard Map (MapLibre GL JS)**: Dynamic vector maps plotting citizen emergency pins, NDMA Sachet hazard polygons, and confirmed crisis perimeters.
* **In-Browser Tesseract.js OCR Engine**: Zero-server prescription and oxygen requirement verification directly inside the browser, extracting doctor credentials, MMC registration numbers, and dosage specs.
* **Multi-Persona Volunteer Simulator**: Built-in test harness allowing operators to simulate universal donors (`O-`, `A+`, `B+`) and NGO response units (`Red Cross Mumbai`) in real-time.

### ⚙️ 3. High-Concurrency Backend Engine
* **Atomic Concurrency Protection ("First-Accept-Wins")**: Conditional Postgres row updates + unique constraints preventing double-assignment races (`409 Conflict Guard`).
* **Automated 3-Stage Verification Pipeline**: Rule-based verification on request creation (`Duplicate check` ➔ `Completeness check` ➔ `Evidence / Phone / Video check`).
* **Autonomous Spatial Incident Clustering**: Groups proximal emergency calls into unified incidents, automatically escalating priority and expanding search radii (5km ➔ 15km ➔ 30km).
* **ABO/Rh Blood Compatibility Matrix**: Algorithmic matching ensuring blood requests only ping medically compatible donors.
* **Dual WebSocket Protocol**: Supports both multiplexed (`/ws?channels=...`) and path-based (`/ws/{channel_type}/{channel_id}`) clients with non-blocking broadcast fan-out.

---

## 📊 System Architecture & Data Flow Diagrams

### 1. High-Level System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Mobile["📱 Flutter Mobile App<br/>(Citizens & Field Volunteers)"]
        WebAdmin["💻 React Web Admin<br/>(NGO Command & Triage)"]
        WebSim["🧪 Volunteer Simulator<br/>(Desktop Radar & Testing)"]
        OCR["🔍 In-Browser Tesseract OCR<br/>(Client-Side Worker)"]
    end

    subgraph "FastAPI Backend Gateway"
        REST["REST API Routers<br/>(/sos, /requests, /incidents, /zones, /auth)"]
        WSManager["WebSocket Connection Manager<br/>(Multiplexed & Path Channels)"]
        Verify["3-Stage Verification Engine"]
        BloodEngine["ABO/Rh Blood Matcher"]
        ClusterEngine["Spatial Clustering Engine"]
        Expiry["Stale Request Sweeper (45m)"]
    end

    subgraph "Data & Persistence Layer (Supabase)"
        Postgres[(PostgreSQL 15+)]
        Extensions["Postgres Extensions:<br/>• cube<br/>• earthdistance"]
        Tables["Tables:<br/>requests • incidents • matches<br/>helpers • messages • confirmed_zones"]
        Locks["Concurrency Control:<br/>pg_advisory_xact_lock<br/>matches_request_id_uniq"]
    end

    subgraph "External GIS & Telemetry"
        OSRM["OSRM Routing Engine<br/>(Shortest Road Paths)"]
        Sachet["NDMA Sachet Feeds<br/>(Govt Disaster Alerts)"]
    end

    Mobile --> REST
    Mobile --> WSManager
    WebAdmin --> REST
    WebAdmin --> WSManager
    WebAdmin --> OCR
    WebSim --> REST
    WebSim --> WSManager

    REST --> Verify
    REST --> BloodEngine
    REST --> ClusterEngine
    REST --> Postgres
    WSManager --> REST
    Expiry --> Postgres

    Postgres --- Extensions
    Postgres --- Tables
    Postgres --- Locks

    Mobile -.-> OSRM
    WebAdmin -.-> OSRM
    WebAdmin -.-> Sachet
```

---

### 2. Critical 1-Tap SOS & Incident Escalation Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Citizen as 🚨 Citizen (Flutter App)
    participant API as FastAPI Backend
    participant DB as PostgreSQL (Supabase)
    participant WS as WebSocket Hub
    actor Responders as 🚑 Volunteers (Mobile & Web)
    actor NGO as 🛡️ NGO Mission Control

    Citizen->>API: POST /sos (lat, lng, category, device_id)
    Note over API,DB: Serialized by pg_advisory_xact_lock("sos:{category}")
    API->>DB: Check active incidents within 1km & 30m window
    alt Incident Exists
        API->>DB: UPDATE incidents SET priority = priority + 1, request_count = request_count + 1
    else New Incident Site
        API->>DB: INSERT into incidents ('sos_triggered') & incident_events
    end
    API->>DB: INSERT into requests (urgency='high', severity_class='critical')
    API->>DB: Advance status -> 'alert_sent'
    API->>WS: Broadcast NEW_REQUEST & INCIDENT_UPDATE
    par Real-Time Fan-Out
        WS-->>Responders: Audio Alert + Radar Pin + OSRM Route
    and
        WS-->>NGO: Urgent Triage Badge + Hazard Perimeter
    and
        API-->>Citizen: 201 Created (Incident ID + Live Status Tracker)
    end
```

---

### 3. Atomic Concurrency Lock ("First-Accept-Wins")

```mermaid
sequenceDiagram
    autonumber
    actor RespA as 🚑 Responder Alpha
    actor RespB as 🚑 Responder Beta
    participant API as FastAPI Backend
    participant DB as PostgreSQL

    Note over RespA,RespB: Both tap "Accept Request" at the exact same millisecond
    par Simultaneous Accept Requests
        RespA->>API: POST /requests/{id}/accept
    and
        RespB->>API: POST /requests/{id}/accept
    end

    API->>DB: (Tx 1) UPDATE requests SET status='matched' WHERE id=$1 AND status='requested' RETURNING *
    API->>DB: (Tx 2) UPDATE requests SET status='matched' WHERE id=$1 AND status='requested' RETURNING *

    Note over DB: Postgres row lock serializes Tx 1 and Tx 2
    DB-->>API: Tx 1 succeeds (1 row updated)
    DB-->>API: Tx 2 returns 0 rows (status is already 'matched')

    API->>DB: Tx 1 inserts into matches (request_id, helper_id)
    API->>DB: Tx 1 commits successfully
    API->>API: Tx 2 rolls back

    API-->>RespA: 200 OK (Match Confirmed, OSRM Road Route Rendered)
    API-->>RespB: 409 Conflict ("Already accepted by Responder Alpha")
```

---

### 4. Database Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    INCIDENTS ||--o{ REQUESTS : "clusters"
    INCIDENTS ||--o{ INCIDENT_EVENTS : "logs timeline"
    REQUESTS ||--o| MATCHES : "claims (1-to-1 unique)"
    HELPERS ||--o{ MATCHES : "dispatched to"
    MATCHES ||--o{ MESSAGES : "contains chat"
    HELPERS ||--o{ DEVICE_TOKENS : "registers push"
    ZONE_REPORTS }o--o| CONFIRMED_ZONES : "aggregates into"

    REQUESTS {
        uuid id PK
        text category
        text urgency
        text status
        float lat
        float lng
        text requester_device_id
        text admin_status
        uuid linked_request_id FK
        uuid incident_id FK
        jsonb service_details
        text verification_status
        text[] verification_reasons
        timestamptz offline_created_at
        timestamptz created_at
    }

    INCIDENTS {
        uuid id PK
        text category
        float center_lat
        float center_lng
        text status
        int priority
        int request_count
        jsonb assessment
        text[] coordinating_orgs
        timestamptz created_at
    }

    MATCHES {
        uuid id PK
        uuid request_id FK "UNIQUE CONSTRAINT"
        uuid helper_id FK
        text status
        timestamptz matched_at
    }

    HELPERS {
        uuid id PK
        text name
        text phone "UNIQUE"
        text email
        text role
        text blood_type
        text darpan_id
        text[] skills
        boolean verified
        boolean available
        float lat
        float lng
    }

    MESSAGES {
        uuid id PK
        uuid match_id FK
        text sender_id
        text body
        timestamptz sent_at
    }

    ZONE_REPORTS {
        uuid id PK
        text category
        float lat
        float lng
        text device_id
        timestamptz reported_at
    }

    CONFIRMED_ZONES {
        uuid id PK
        text category
        float center_lat
        float center_lng
        text ml_status
        timestamptz confirmed_at
    }
```

---

## 📂 Repository Structure

```
Crisis-Connect/
├── backend/                    # FastAPI High-Concurrency Backend
│   ├── main.py                 # Backend entrypoint (uvicorn main:app)
│   ├── schema.sql              # Complete PostgreSQL DDL (extensions, indexes, locks)
│   ├── requirements.txt        # Python backend dependencies
│   ├── test_backend.py         # End-to-end API integration tests
│   ├── app/                    # Modular Application Core
│   │   ├── config.py           # Environment config & constants
│   │   ├── db.py               # asyncpg connection pooling
│   │   ├── schemas.py          # Pydantic validation schemas
│   │   ├── verification.py     # 3-stage mechanical verification pipeline
│   │   ├── incident_status.py  # Monotonic incident state progression
│   │   ├── blood.py            # Universal blood donor compatibility matrix
│   │   ├── expiry.py           # Stale request background expiry sweeper
│   │   ├── ws.py               # WebSocket ConnectionManager with channel pub/sub
│   │   ├── auth.py             # Stateless HMAC-SHA256 session tokens
│   │   ├── demo_seed.py        # Curated Mumbai disaster scenario seeder
│   │   └── routers/            # Modular Endpoint Routers
│   │       ├── sos.py          # 1-tap SOS distress beacon
│   │       ├── requests.py     # Request CRUD, enrich, atomic accept, blood query
│   │       ├── incidents.py    # Spatial clustering, assessment, escalation
│   │       ├── auth.py         # 2FA OTP simulation, helper registration, login
│   │       ├── matches.py      # Match status transitions
│   │       ├── messages.py     # Direct match live chat
│   │       ├── zones.py        # Crowdsourced hazard pins & NDMA Sachet alerts
│   │       └── helpers.py      # Helper profile & availability management
│   └── tests/                  # Pytest & race condition test suites
│
├── frontend/                   # Web Mission Control (React 18 + Vite PWA)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── App.jsx             # Root layout with role & persona routing
│       ├── index.css           # Mission control styling & animation tokens
│       ├── services/
│       │   ├── api.js          # Adaptive environment REST client
│       │   ├── websocket.js    # Resilient auto-reconnecting WebSocket client
│       │   └── ocrService.js   # Client-side Tesseract.js OCR engine
│       ├── utils/
│       │   ├── prescriptionParser.js # Doctor & medicine entity extractor
│       │   ├── routeUtils.js         # OSRM road shortest route calculator
│       │   ├── audioChime.js         # Web Audio API emergency alert chimes
│       │   ├── bloodCompatibility.js # Universal blood compatibility rules
│       │   └── device.js             # Device UUID persistence
│       └── components/
│           ├── Header.jsx            # Top mission control bar with live WS indicator
│           ├── Requester/            # 1-Tap SOS, Enrichment, Status, Live Map
│           ├── Critical/             # SOS Button & Status View
│           ├── Admin/                # Urgency Triage Queue & GIS Crisis Map
│           ├── Simulation/           # Volunteer Mobile Radar Simulator
│           ├── Auth/                 # Multi-Step 2FA Onboarding Modal
│           └── ZoneReport/           # Public Crowdsourced Hazard Pin-Drop
│
├── mobile/                     # Flutter Mobile App (iOS & Android)
│   ├── pubspec.yaml            # Flutter dependencies (geolocator, web_socket_channel, etc.)
│   └── lib/                    # Mobile screens for Citizen SOS & Field Volunteers
│
├── docs/                       # Specifications, PRDs & Integration Contracts
│   ├── INTEGRATION-CONTRACT.md # Authoritative API & WebSocket contract
│   ├── CrisisConnect-PRD.md    # Product requirements document
│   └── WEBSOCKET-CONTRACT.md   # Real-time event specification
└── render.yaml                 # 1-Click Render cloud deployment blueprint
```

---

## 🚀 Quick Start Guide

### 1. Database Setup (Supabase / Local PostgreSQL)
1. Create a PostgreSQL 15+ database (e.g., in Supabase).
2. Open the SQL Editor and execute [`backend/schema.sql`](file:///c:/Users/Rudra/OneDrive/Desktop/crisis-connect/backend/schema.sql) to install the `cube` and `earthdistance` extensions, create tables, and configure unique indexes.

### 2. Configure Backend Environment
Create `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT].supabase.co:5432/postgres
SESSION_SECRET=your-secure-random-secret
PORT=8000
HOST=0.0.0.0
```

### 3. Run Backend
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate | Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
python main.py
```
* **API Documentation**: `http://localhost:8000/docs`
* **Health Check**: `http://localhost:8000/health`
* **Reseed Demo Scenarios**: `POST http://localhost:8000/seed`

### 4. Run Web Mission Control (Frontend)
```bash
cd frontend
npm install
npm run dev
```
* **Mission Control Web App**: `http://localhost:5173`

---

## 🧪 Testing & Verification

### Run End-to-End API Test Suite:
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

## 🌐 Deployment (Render & Vercel)

CrisisConnect includes a cloud blueprint ([`render.yaml`](file:///c:/Users/Rudra/OneDrive/Desktop/crisis-connect/render.yaml)) for 1-click cloud deployment:
* **Backend**: FastAPI web service with WebSocket support on Render.
* **Frontend**: React Vite static site on Vercel or Render.
* The frontend dynamically auto-detects `localhost`, local LAN IP, or production backend endpoints.
