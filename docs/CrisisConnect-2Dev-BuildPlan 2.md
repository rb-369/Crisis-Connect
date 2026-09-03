# CrisisConnect — Build Plan (2 Devs, 7 Hours)

**Dev A** — full-stack, no Flutter → simpler backend CRUD + React web (Requester + Admin). Lighter column, real slack in the back half.
**Dev B** — full-stack, knows Flutter, more experienced/better tooling → owns the hard/shared backend infra + Volunteer-specific backend + full Flutter app. Tighter column, ~6.5h, last block is the cut-first item if behind.
**Hour 7** — both together, full integration + demo prep.

Both devs use Claude Code / Antigravity throughout — see "Where to point your agent" at the bottom.

---

## Ideal Tech Stack

**Backend: FastAPI (Python) + native WebSockets.** FastAPI's WebSocket support is lower-level than Socket.io — no built-in rooms — so budget real time for a connection manager (map of active connections per request/match/zone channel, broadcast function, disconnect cleanup). This is the one piece of infra everything else depends on; Dev B builds it first.

**Database: Supabase, used only as hosted Postgres** (skip Supabase's client SDK/Realtime — you're rolling your own real-time via WebSocket). Get the connection string from the Supabase dashboard, connect via `asyncpg` or `psycopg` from FastAPI.

**Speed hybrid:** use the `supabase-py` client for simple CRUD (basic inserts/selects — free, no hand-written SQL needed) and drop to raw SQL (`asyncpg`) only for the operations that need precise atomic control: the accept endpoint, duplicate detection, zone-threshold check. Don't hand-write basic CRUD by hand when the client library does it for you.

**Deploy FastAPI immediately** to Railway or Render (git-push deploy) so it has a public URL from hour 1 — the Flutter app needs to reach it from a real device/emulator; don't develop against localhost and deploy later.

**Auth:** Mock OTP (any code accepted, or a fixed demo code) — real SMS needs a telephony provider regardless of framework, not worth building for a demo. If you want real Supabase Auth phone OTP instead, that adds JWT-verification integration work in FastAPI — only take that on if you have real slack, otherwise mock it.

**Geospatial:** Postgres `cube` + `earthdistance` extensions, plain `lat`/`lng` double columns, `earth_distance()` for radius queries.

**React web:** Vite + React + Tailwind + native `WebSocket` API (or a thin wrapper) + Google Maps/Mapbox.

**Flutter mobile:** Flutter + `web_socket_channel` package + `http` + `google_maps_flutter`.

**Requester identity:** no auth — client-generated UUID stored locally, sent as `requester_device_id`.

---

## Shared Schema (build together, first 30 min, both devs present)

```sql
create extension if not exists cube;
create extension if not exists earthdistance;

create table requests (
  id uuid primary key default gen_random_uuid(),
  category text not null, -- blood/food/medicine/oxygen/shelter/transport/rescue
  urgency text not null default 'normal', -- auto-high for oxygen/rescue
  status text not null default 'requested', -- requested/matched/in_progress/resolved/expired
  lat double precision not null,
  lng double precision not null,
  requester_device_id text not null,
  requester_name text,
  requester_phone text,
  details text,
  photo_url text,
  admin_status text not null default 'pending', -- pending/approved/rejected/flagged
  zone_confirmed boolean default false,
  ml_status text,
  linked_request_id uuid references requests(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table helpers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text unique not null,
  role text not null, -- volunteer/ngo_admin
  org_name text,
  verified boolean default false,
  available boolean default false,
  lat double precision,
  lng double precision
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id) not null,
  helper_id uuid references helpers(id) not null,
  status text not null default 'en_route', -- en_route/arrived/resolved
  matched_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references matches(id) not null,
  sender_id text not null,
  body text not null,
  sent_at timestamptz default now()
);

create table zone_reports (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  lat double precision not null,
  lng double precision not null,
  device_id text not null,
  reported_at timestamptz default now()
);

create table confirmed_zones (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  ml_status text,
  confirmed_at timestamptz default now()
);
```

**Radius query (nearby requests for a volunteer):**
```sql
select * from requests
where status = 'requested' and admin_status != 'rejected'
and earth_distance(ll_to_earth(lat, lng), ll_to_earth(:lat, :lng)) < :radius_m
order by urgency desc, created_at asc;
```

**Atomic accept (race-safe — the single most important query in the app):**
```sql
update requests set status = 'matched', updated_at = now()
where id = :request_id and status = 'requested'
returning *;
-- 0 rows returned = someone else already got it, reject the accept client-side
```

---

## Dev B Plan — Shared Backend Infra + Volunteer (Backend + Flutter)

| Time | Task |
|---|---|
| 0:00–0:30 | **Shared:** schema, Supabase Postgres setup, FastAPI skeleton deployed to Railway/Render with a live public URL, agree WebSocket message format (event types: `new_request`, `matched`, `status_update`, `new_message`, `zone_confirmed`) |
| 0:30–1:15 | WebSocket connection manager: track connections per request/match/zone channel, broadcast function, disconnect cleanup — everything else depends on this |
| 1:15–1:45 | Atomic accept endpoint (`POST /requests/{id}/accept`) using the race-safe SQL above, broadcasts `matched` event |
| 1:45–2:15 | Zone-threshold logic: on `zone_reports` insert, check cluster count within radius+time, insert into `confirmed_zones`, broadcast `zone_confirmed` |
| 2:15–2:45 | Duplicate detection: on request insert, check existing active request within radius+time+category, set `linked_request_id` |
| 2:45–3:15 | Volunteer-specific endpoints: `GET /requests/nearby` (radius query), mock OTP, availability toggle |
| 3:15–4:00 | Flutter scaffold, `web_socket_channel` + `http` setup, OTP login + availability toggle screen |
| 4:00–4:45 | Nearby feed screen (WebSocket subscribe for `new_request` + REST fetch) |
| 4:45–5:30 | Request detail + Accept button + status flow screen (En Route → Arrived → Resolved) |
| 5:30–6:15 | In-app chat screen (WebSocket) |
| 6:15–6:30 | **Cut-first-if-behind:** volunteer history list (resolved matches) |

## Dev A Plan — Simple Backend CRUD + React (Requester + Admin)

| Time | Task |
|---|---|
| 0:00–0:30 | **Shared:** schema, Postgres, FastAPI skeleton deploy — with Dev B |
| 0:30–1:00 | Simple CRUD via `supabase-py`: `POST /requests`, `GET /requests` (admin queue), `PATCH /requests/{id}` (approve/reject), `POST /messages`, `GET /messages/{matchId}` |
| 1:00–1:30 | React scaffold + Requester Step 1: category picker, auto-GPS, instant submit |
| 1:30–2:00 | Requester Step 2 (optional info) + live status view (WebSocket subscribe on request channel) |
| 2:00–2:45 | NGO/Admin dashboard: request queue, approve/reject UI |
| 2:45–3:15 | Admin map view + `confirmed_zones` overlay |
| 3:15–3:45 | Crisis zone pin-drop screen — **built on React, not Flutter**, since the PRD says any user (logged in or not) can report a zone, not just volunteers. This isn't volunteer-specific, so it belongs on the low-friction web surface. |
| 3:45–4:15 | Chat UI, requester side (WebSocket) |
| 4:15–4:45 | Duplicate/linked-request UI indicator ("N others also need this here") |
| 4:45–6:00 | Buffer + polish. If ahead of schedule, jump in on Dev B's Flutter screens — this is the slack that offsets Dev B's tighter column. |

---

## Hour 7 — Integration & Wiring (both together)

1. Confirm the Flutter app can reach the deployed FastAPI backend from a real device/emulator — test this first.
2. Submit a request on React → confirm it appears in Flutter's feed via WebSocket.
3. Accept on Flutter → confirm React sees "Matched" instantly.
4. Chat both directions, confirm live delivery on both apps.
5. Walk one request through the full status lifecycle, confirm both sides update.
6. Test admin approve/reject.
7. Drop 3+ zone reports to cross the confirmation threshold, confirm it shows on the admin map.
8. Fix critical breakage only — no new features this hour.
9. Reset/seed clean demo data.
10. Confirm GPS + backend connectivity on the venue's actual wifi/mobile data.

---

## Where to Point Your Coding Agent

- **Simple CRUD via `supabase-py`** — nearly free, let the agent wire this directly from the schema.
- **WebSocket connection manager boilerplate** — has a fixed shape (connect, register to channel, broadcast, cleanup on disconnect) — scaffold once, reuse the pattern for all four channel types.
- **Mock OTP flow** — trivial, fully agent-writable.
- **Map integration boilerplate** — repetitive on both React and Flutter, agent-scaffoldable.

**Don't delegate blindly:** the atomic accept query and the zone-threshold logic are the two places a subtle bug (race condition, wrong threshold math) breaks the core demo. Test the accept endpoint explicitly with two near-simultaneous requests before hour 7 — don't assume the agent got the `WHERE status = 'requested'` guard right just because it compiles.
