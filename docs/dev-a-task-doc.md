# Task Doc — Dev A (Backend CRUD + React: Requester & Admin)

**Total budget: 6 hours build, then join Dev B for Hour 7 integration.**
**Stack:** FastAPI + Supabase (Postgres only) + native WebSockets + React (Vite + Tailwind).

Work through steps in order. Each step has a Task, the Actions to take, and Acceptance Criteria to confirm before moving on.

---

## Step 0 — Shared Kickoff (0:00–0:30, with Dev B)

**Task:** Get the shared foundation in place before either of you writes feature code.

**Actions:**
- Create the Supabase project, get the Postgres connection string.
- Run the shared schema (below) against it.
- Scaffold a bare FastAPI app, deploy it to Railway or Render immediately — confirm you get back a live public URL.
- Agree with Dev B on the WebSocket event format: `new_request`, `matched`, `status_update`, `new_message`, `zone_confirmed`.

```sql
create extension if not exists cube;
create extension if not exists earthdistance;

create table requests (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  urgency text not null default 'normal',
  status text not null default 'requested',
  lat double precision not null,
  lng double precision not null,
  requester_device_id text not null,
  requester_name text,
  requester_phone text,
  details text,
  photo_url text,
  admin_status text not null default 'pending',
  zone_confirmed boolean default false,
  ml_status text,
  linked_request_id uuid references requests(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table helpers (
  id uuid primary key default gen_random_uuid(),
  name text, phone text unique not null, role text not null,
  org_name text, verified boolean default false, available boolean default false,
  lat double precision, lng double precision
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) not null,
  helper_id uuid references helpers(id) not null,
  status text not null default 'en_route',
  matched_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) not null,
  sender_id text not null, body text not null, sent_at timestamptz default now()
);

create table zone_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null, lat double precision not null, lng double precision not null,
  device_id text not null, reported_at timestamptz default now()
);

create table confirmed_zones (
  id uuid primary key default gen_random_uuid(),
  category text not null, center_lat double precision not null, center_lng double precision not null,
  ml_status text, confirmed_at timestamptz default now()
);
```

**Acceptance criteria:**
- [ ] Schema runs against Supabase without error.
- [ ] FastAPI skeleton is deployed and reachable at a public URL (test with a browser or curl).
- [ ] Both devs have the WebSocket event names written down somewhere shared.

---

## Step 1 — Simple CRUD Endpoints (0:30–1:00)

**Task:** Build the basic request/message endpoints Dev B's harder logic and your own frontend will both depend on.

**Actions:**
- Use `supabase-py` client for these — don't hand-write SQL for basic CRUD.
- `POST /requests` — create a request.
- `GET /requests` — list requests (support filtering by `admin_status` for the admin queue).
- `PATCH /requests/{id}` — update `admin_status` (approve/reject/flag).
- `POST /messages` — send a chat message.
- `GET /messages/{match_id}` — fetch a match's message history.

**Acceptance criteria:**
- [ ] All five endpoints callable and return expected data via curl/Postman.
- [ ] `POST /requests` correctly writes all fields from the schema, including `requester_device_id`.
- [ ] `PATCH /requests/{id}` correctly updates `admin_status` and nothing else unintended.

---

## Step 2 — Requester Step 1: Instant Report (1:00–1:30)

**Task:** Build the zero-friction first screen — category select + auto-location + instant submit.

**Actions:**
- React scaffold (Vite + Tailwind).
- Generate a UUID client-side on first load, store in localStorage as the device identity.
- Icon grid for the 7 categories (blood/food/medicine/oxygen/shelter/transport/rescue).
- Auto-capture GPS via browser geolocation API; fallback to manual pin-drop if permission denied.
- On category tap: submit immediately via `POST /requests` (category + urgency + lat/lng + device_id). No other fields required.

**Acceptance criteria:**
- [ ] Tapping a category creates a request with correct lat/lng within 2-3 taps total.
- [ ] Oxygen and rescue categories auto-set `urgency` to high.
- [ ] Works with GPS denied (manual pin-drop fallback functions).

---

## Step 3 — Requester Step 2 + Live Status (1:30–2:00)

**Task:** Optional enrichment form + a live-updating status screen.

**Actions:**
- After Step 1 submits, show an optional form: name, phone, details, photo. Skippable.
- Status screen subscribes to the WebSocket channel for this request's `id`.
- Render status states: Requested → Matched → In Progress → Resolved, updating live as WebSocket events arrive.

**Acceptance criteria:**
- [ ] Skipping Step 2 doesn't block or delay the request from being visible to volunteers.
- [ ] Status screen updates without a page refresh when the WebSocket sends a `status_update` or `matched` event.

---

## Step 4 — NGO/Admin Dashboard (2:00–2:45)

**Task:** Build the review queue for admins/NGOs.

**Actions:**
- List view of requests sorted by urgency then time, filterable by `admin_status`.
- Approve / Reject / Flag buttons calling `PATCH /requests/{id}`.
- Show request detail (category, location, requester info if provided, current status).

**Acceptance criteria:**
- [ ] Queue correctly sorts by urgency first, then recency.
- [ ] Approve/Reject/Flag actions update immediately in the UI and persist on refresh.
- [ ] High-urgency requests (oxygen/rescue) are visually distinguished at the top.

---

## Step 5 — Admin Map + Zone Overlay (2:45–3:15)

**Task:** Visual map view for admins showing active requests and confirmed crisis zones.

**Actions:**
- Integrate Google Maps or Mapbox.
- Plot active requests as pins (colored/icon by category).
- Overlay `confirmed_zones` as shaded areas or distinct markers.

**Acceptance criteria:**
- [ ] Map renders and correctly plots at least one test request.
- [ ] Confirmed zones are visually distinct from individual request pins.

---

## Step 6 — Crisis Zone Pin-Drop (3:15–3:45)

**Task:** Build the "report what you're seeing" feature — this belongs on the web/React side since any user (not just volunteers) can use it.

**Actions:**
- Simple screen: category select + auto-location (or manual pin) + submit button.
- Submits to `POST /zone-reports` (this endpoint is Dev B's — confirm it exists before wiring, or coordinate timing).

**Acceptance criteria:**
- [ ] A submitted zone report appears in the `zone_reports` table.
- [ ] No login required to use this screen.

---

## Step 7 — Chat UI, Requester Side (3:45–4:15)

**Task:** Let a matched requester chat with their volunteer/NGO.

**Actions:**
- Chat screen appears once a request reaches `matched` status.
- Subscribes to the match's WebSocket channel for `new_message` events.
- Send box posts to `POST /messages`.

**Acceptance criteria:**
- [ ] Messages sent from this screen appear instantly on the volunteer's Flutter chat screen (test together with Dev B once both sides exist).
- [ ] Message history loads correctly via `GET /messages/{match_id}` on screen open.

---

## Step 8 — Duplicate/Linked Request Indicator (4:15–4:45)

**Task:** Surface Dev B's duplicate-detection logic in the UI.

**Actions:**
- On the admin dashboard and/or requester status screen, if `linked_request_id` is set, show "N others nearby also need this."
- This is a display-only step — the detection logic itself is Dev B's.

**Acceptance criteria:**
- [ ] A request with a non-null `linked_request_id` visibly shows the linked-count indicator.

---

## Step 9 — Buffer, Polish, Assist Dev B (4:45–6:00)

**Task:** Use remaining time for bug fixes, polish, and — if you're ahead of schedule — help Dev B's Flutter screens.

**Actions:**
- Fix any known bugs from earlier steps.
- Seed realistic demo data (a handful of requests across categories/urgency).
- If ahead: check in with Dev B, offer to pick up a Flutter screen or backend endpoint that's behind.

**Acceptance criteria:**
- [ ] No known critical bugs remain in your own flows.
- [ ] Demo data is seeded and looks realistic, not placeholder text.
