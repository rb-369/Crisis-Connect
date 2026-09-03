# CrisisConnect — Product Requirements Document

**Problem statement (SIC1):** A centralized emergency assistance and community response platform connecting people in urgent need with volunteers, NGOs, and authorized organizations during disasters, accidents, and medical emergencies — supporting request creation, verification, discovery, tracking, location-based matching, and real-time status updates while preventing duplicate/fake requests.

**Build window:** 18 hours total. MVP core build: 10 hours (this doc). Remaining ~8 hours: polish, testing, demo prep (see separate hour-by-hour plan).

---

## 1. Design Principles

These override feature-completeness wherever they conflict — if a feature adds friction or cognitive load for the requester, cut it or defer it.

1. **Zero cognitive load to submit a request.** A person in crisis should be able to send a help request in under 3 taps, no typing required for the first submission.
2. **No login required to ask for help.** Login is a barrier in a life-or-death moment. Login is fine — required, even — for people *providing* help, because accountability matters there.
3. **Every design decision should assume the requester's brain is not working at full capacity.** Big buttons, minimal text, category icons, auto-filled location.
4. **Trust is layered, not gated.** Don't block a request from going out while verification happens — verify in parallel, and let urgency override caution for the most critical categories.

---

## 2. Users & Roles

| Role | Login | Platform | Why |
|---|---|---|---|
| **Requester** | Not required to submit. Optional lightweight profile after. | React web (PWA) | Zero-install is critical — a requester should never have to download an app before help can reach them. A web link works instantly on any phone. |
| **Volunteer** | Mandatory (phone + OTP) | Flutter mobile app | Repeat, ongoing use justifies an install. Native app gives reliable push notifications for fast response — this matters more than for a one-time requester. |
| **NGO / Admin** | Mandatory (phone + OTP or email, org-verified) | React web | Desktop-based review/management work; org accounts should be manually approved or pre-seeded, not self-serve signup, to prevent fake orgs. |

**Note on the stated stack:** you said React + Flutter on a common backend. Recommended split above resolves a friction conflict — if the requester needs to install a Flutter app first, that directly violates "low effort in an emergency." React as an installable-free web app for requesters solves this; Flutter is justified for volunteers who use it repeatedly and benefit from native push.

---

## 3. Identity Model (Requester)

Two-step, matching your instinct, with the IP fix applied:

**Step 1 — Instant report (no typing required):**
- Auto-capture: device-local anonymous UUID (generated + stored on first use, this is the actual identity anchor — not IP), GPS location, timestamp.
- User taps: category (icon grid — Blood / Food / Medicine / Oxygen / Shelter / Transport / Rescue), urgency (if not auto-set by category).
- Request is created and enters the matching queue **immediately** — do not block on step 2.

**Step 2 — Optional enrichment (shown after step 1 submits, skippable):**
- Name, age, phone number (optional but strongly encouraged — needed for chat/contact once matched), free-text details, photo upload.
- Requester can fill this in later, or a matched volunteer/NGO can request it live via chat.

**Why phone number should still be soft-collected here:** without *some* contact channel, "chat with your matched volunteer" doesn't work. Frame it as "add your number so your volunteer can reach you" at the moment of highest motivation (right after they see a match), not as a blocking field at submission.

---

## 4. Verification System — MVP Scope

Per your prioritization: **Layer 1 (Admin/NGO approval) and Layer 2 (crowd zone confirmation) are MVP. Layer 3 (ML event-corroboration) is a parallel bolt-on track, not a blocking dependency** — it's being built separately by one dev on its own 7-hour budget; if it's ready, wire it in as an extra signal, if not, MVP works fully without it.

### Layer 1 — Admin/NGO Manual Approval
- Every new request lands in an NGO/Admin review queue, sorted by urgency + time.
- Admin can: Approve (opens matching to volunteers), Reject (spam/duplicate), Flag for more info.
- **Critical rule:** high-urgency categories (rescue, oxygen) should be visible to volunteers *immediately* on submission, with admin approval running in parallel, not gating them — a life-critical request should never sit in a queue waiting for a human to click approve.

### Layer 2 — Crowd-Sourced Crisis Zone Confirmation
This is your "Google Maps-style reporting," scoped concretely:
- Any user (no login needed) can drop a pin: "I can confirm a crisis is happening here" — tied to a location + rough category (flood/fire/accident/etc.), not tied to any individual's request.
- When enough confirmations cluster in one area within a time/distance window (e.g. 3+ reports within 500m in 30 min), that area becomes a **Confirmed Active Zone** on the map.
- Individual requests originating inside a Confirmed Zone get a visible "Likely genuine — area confirmed" badge and can skip/fast-track manual approval.
- Requests far outside any confirmed zone are flagged for extra admin scrutiny, not auto-rejected.

### Layer 3 — ML Event Corroboration (bolt-on, non-blocking)
- Same mechanism as Layer 2 but checks against real news instead of crowd reports — see separate task doc. Wire in as an additional badge/signal on the request if the endpoint is ready in time. Do not let the main build wait on this.

---

## 5. Main User Flows

### Flow A — Requester submits and gets matched
1. Requester opens the web link (no install, no login).
2. Taps category icon (e.g. "Blood") → urgency auto-set or selected.
3. Location auto-captured via browser GPS (fallback: manual pin drop if GPS denied).
4. Request submitted → enters matching queue instantly, requester sees "Finding help near you..." with live status.
5. (Optional, non-blocking) prompted to add name/phone/details — can skip.
6. Request is broadcast to nearby available volunteers within a radius (Rapido-style).
7. First volunteer/NGO to accept is matched — requester is notified instantly, sees matched helper's name/type (volunteer or org) and live status.
8. Requester can open in-app chat with the matched helper (call/number-reveal optional add-on).
9. Status updates through: Requested → Matched → In Progress → Resolved. Requester can mark resolved, or confirm resolution when helper marks it.

### Flow B — Volunteer responds to a request
1. Volunteer logs in (phone + OTP), sets availability toggle ON.
2. Sees a live feed/map of nearby active, approved (or zone-confirmed) requests within radius, sorted by urgency + distance.
3. Taps a request to view details, taps Accept.
4. First-accept-wins — if another volunteer already accepted, shown "already matched" and returned to feed.
5. Gets requester's live location + any provided details, in-app chat opens.
6. Marks status: En Route → Arrived → Resolved.
7. Resolved requests move to volunteer's history.

### Flow C — NGO/Admin reviews and manages
1. Admin logs in to web dashboard.
2. Sees: pending approval queue (sorted by urgency/time), live map with Confirmed Zones overlaid, active/resolved request stats.
3. Approves/rejects/flags pending requests.
4. Can view any request's full detail, chat log, matched volunteer, and status history.
5. Can manually mark a request as duplicate/expired.

### Flow D — Crisis zone confirmation (any user)
1. User (logged in or not) sees a "Report what you're seeing" button on the map view.
2. Selects rough category + confirms current location (or drops pin manually).
3. Submission adds to the zone confirmation count for that area.
4. Map updates live — zones crossing the confirmation threshold visually change (e.g. yellow → red "Confirmed Active").

### Flow E — Duplicate/stale request handling
1. On submission, system checks for existing active requests within a small radius + time window with the same category.
2. If a likely duplicate is found: new request is linked to the existing one (increments a "N people also need this here" counter) rather than creating a separate entry — this also strengthens the request's priority signal.
3. Requests with no status update after a set time window are prompted to the requester: "Still need help?" — no response after a further window auto-expires the request.

---

## 6. Data Model (simplified)

**Request**
`id, category (enum: blood/food/medicine/oxygen/shelter/transport/rescue), urgency (auto or manual), status (requested/matched/in_progress/resolved/expired), location (lat/long), requester_device_id, requester_name (nullable), requester_phone (nullable), details (nullable text), photo_url (nullable), created_at, updated_at, admin_status (pending/approved/rejected/flagged), zone_confirmed (bool), ml_corroboration_status (nullable)`

**Volunteer / NGO User**
`id, name, phone, role (volunteer/ngo_admin), org_name (nullable, for NGO), verified (bool), available (bool), current_location, rating (phase 2)`

**Match**
`id, request_id, helper_id, matched_at, status (en_route/arrived/resolved), chat_thread_id`

**ZoneReport**
`id, location, category, reported_at, device_id`

**ConfirmedZone** (derived, not stored directly — computed from ZoneReport clustering, or cached if performance requires it)

---

## 7. MVP Feature List (10-hour build) vs Phase 2

**MVP — must ship:**
- Request submission (2-step, all 7 categories, one generalized schema)
- Instant matching queue + Rapido-style broadcast/first-accept matching
- Live status tracking (5-state lifecycle)
- Volunteer login + availability toggle + nearby request feed
- NGO/Admin login + review dashboard + approve/reject
- Crowd zone confirmation (pin drop + threshold-based Confirmed Zone)
- In-app chat between matched pair
- Duplicate detection (radius + time window) + auto-expiry on stale requests
- Basic in-app notifications (no SMS/push infra needed for MVP)

**Phase 2 / stretch (only if ahead of schedule, or post-hackathon):**
- ML event-corroboration bolt-on (separate track — wire in if ready)
- Real or masked voice calling
- SMS/push via Twilio or similar
- Volunteer rating/reputation system
- Multi-language support
- Historical analytics for NGOs
- More sophisticated duplicate detection (beyond simple radius/time)

---

## 8. Open Risks

- **GPS reliability indoors/venue wifi:** test location capture early on the actual hackathon venue's network — don't discover GPS accuracy problems during the demo.
- **First-accept-wins race condition:** two volunteers accepting near-simultaneously needs a proper backend lock (e.g. atomic DB update), not a naive check-then-write — this is a classic bug source, budget real testing time for it.
- **Zone confirmation threshold tuning:** pick a sensible default (e.g. 3 confirmations / 500m / 30 min) and be ready to justify it in Q&A — judges may ask why that number.
- **Requester never adds a phone number:** define what "matched but uncontactable" looks like in the UI — don't leave this as an undefined edge case.

---

## 9. Suggested Tech Approach

- **Backend:** Node/Express or FastAPI + a realtime layer (Supabase Realtime or Socket.io) for live status/matching updates — avoid hand-rolling WebSocket infra from scratch given the time budget.
- **Geospatial matching:** simple radius query (haversine distance in SQL, or PostGIS if using Supabase/Postgres) — no need for a real dispatch-optimization algorithm at this scale.
- **Frontend:** React (PWA-capable) for Requester + Admin; Flutter for Volunteer app.
- **Maps:** Google Maps or Mapbox SDK — don't build custom mapping.
