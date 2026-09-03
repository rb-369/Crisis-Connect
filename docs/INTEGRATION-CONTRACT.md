# CrisisConnect — Integration Contract (v2, critical + non-critical)

**Every agent working on this build reads this file first and treats it as
binding.** It is the only coordination mechanism between the 6 parallel
workstreams. If you believe the contract is wrong, say so in your final
report — do NOT unilaterally change it, and do NOT edit files you don't own.

Source specs: `CrisisConnect-PRD.md`, `CrisisConnect-2Dev-BuildPlan.md`,
`docs/AGENT-FLOW.md` (the flowchart this v2 implements).

---

## 0. Merge decisions (already made — do not relitigate)

1. **Base = this repo's `backend/` (FastAPI + asyncpg + Postgres).** The
   co-dev's `dev-a/backend/` (in-memory primary store) is reference only and
   is NOT run. Port his *features* onto this backend, not his storage model.
2. **Adopt the co-dev's UI/UX patterns and component structure.** His React
   components in `dev-a/frontend/src/` are the visual/interaction reference.
   Port them, rewired to this backend's contract.
3. **The backend owns verification.** Clients may NOT self-approve. Any
   client-sent `admin_status` on create is ignored; the server computes
   `verification_status` + `admin_status`.
4. **Local only.** Build and verify against `localhost:8000`. Leave
   `render.yaml` / Vercel config intact but do not deploy.

---

## 1. Field naming (canonical — the co-dev's names win where they exist)

| Canonical field | Notes |
|---|---|
| `service_details` (jsonb) | Per-category structured fields. **Renamed from my earlier `structured_details`** — use `service_details` everywhere. |
| `voice_note_url` (text) | Requester voice note. |
| `photo_url` (text) | Prescription/photo/proof image. |
| `proof_video_url` (text) | On-scene video proof (co-dev's camera-proof feature). |
| `is_critical` (bool, input alias) | Accepted on input for compatibility; server derives `severity_class` from category and returns both. |
| `severity_class` | `'critical'` \| `'non_critical'`. Server-derived, authoritative. |
| `verification_status` | `pending` \| `incomplete` \| `verified` \| `rejected`. Non-critical only; `null` for critical. |
| `verification_reasons` (text[]) | e.g. `["missing_field:hospital"]`, `["duplicate"]`. |
| `incident_id` (uuid) | Set for critical requests grouped into one incident. |

### `service_details` shapes (match the co-dev's modal exactly)

```
blood:     { blood_group, units, hospital_name, patient_name, patient_condition }
oxygen:    { oxygen_type, flow_rate, patient_name }
medicine:  { medicine_names, dosage, has_prescription_image }
food:      { persons_count, food_items[], water_liters }
shelter:   { persons_count, duration, special_considerations }
transport: { mobility_type, destination }
```

Required-for-verification subset (backend `config.REQUIRED_SERVICE_FIELDS`):
```
blood: [blood_group, units, hospital_name]      oxygen: [oxygen_type, flow_rate]
medicine: [medicine_names]                      food: [persons_count]
shelter: [persons_count]                        transport: [destination]
```

## 2. Category taxonomy

```
CRITICAL      = flood, earthquake, fire, accident, rescue    -> POST /sos
NON_CRITICAL  = blood, oxygen, medicine, food, shelter, transport -> POST /requests
```
`rescue` == the flowchart's "trapped". Sending a critical category to
`/requests` (or vice versa) is a 422 — the flows are mutually exclusive.

## 3. REST surface (authoritative)

### Critical
```
POST   /sos                          {category,lat,lng,requester_device_id,details?,photo_url?,
                                      client_created_at?,via_offline_sync?}
                                     -> 201 {request, incident}
GET    /incidents?status=            -> [incident]
GET    /incidents/{id}               -> incident + .requests[]
POST   /incidents/{id}/assessment    {submitted_by,people_affected?,injuries?,trapped?,
                                      medical_assistance_required?,rescue_required?,
                                      ambulance_required?,food_water_required?,
                                      other_resources?,notes?} -> incident
PATCH  /incidents/{id}               {status?,coordinating_orgs?} -> incident
```
Incident status ladder (monotonic, never regresses):
`sos_triggered -> alert_sent -> responder_accepted -> on_the_way -> assessed -> coordinated -> resolved`

### Non-critical
```
POST   /requests                     {category,lat,lng,requester_device_id,urgency?,
                                      requester_name?,requester_phone?,details?,photo_url?,
                                      voice_note_url?,service_details?} -> 201 request
GET    /requests?admin_status=&status=       -> [request]  (urgency desc, then recency)
GET    /requests/nearby?lat=&lng=&radius_m=  -> [request + distance_m + linked_count]
GET    /requests/{id}                        -> request + .match
PATCH  /requests/{id}                {admin_status?,status?} -> request   (admin triage)
PATCH  /requests/{id}/enrich          {requester_name?,requester_phone?,details?,photo_url?,
                                       voice_note_url?,service_details?} -> request
POST   /requests/{id}/accept          {helper_id, helper_name?,helper_phone?,helper_role?,
                                       blood_group?,helper_lat?,helper_lng?}
                                      -> 200 {request,match,helper} | 409 {code:already_matched|rejected}
POST   /requests/{id}/keepalive       -> {status,kept_alive}
POST   /requests/{id}/resolve         -> request           (requester-initiated close)
POST   /requests/{id}/reopen          {reason?} -> request (flowchart: "not resolved -> reopen")
GET    /requests/{id}/compatible-donors -> {needed_blood_group,compatible_donor_types[],donors[]}
```

### Matches / chat
```
GET    /matches/{id}                 -> match (joined w/ helper + request fields)
PATCH  /matches/{id}                 {status: en_route|arrived|resolved} -> {match,request}
GET    /requests/{id}/match          -> match
GET    /helpers/{id}/matches?status= -> [match]     (volunteer history)
POST   /messages                     {match_id,sender_id,body} -> 201 message
GET    /messages/{match_id}          -> [message]
```

### Auth / helpers (co-dev's names are canonical; my older names kept as aliases)
```
POST   /auth/send-otp                {contact, role?} -> {sent,demo_code,helper_id?}
POST   /auth/verify-otp              {contact, otp_code, role?} -> {token, helper}
POST   /auth/login                   {identifier, role?} -> {token, helper}
GET    /auth/helpers?role=           -> [helper]
POST   /auth/helpers                 {name,phone?,email?,role,org_name?,darpan_id?,blood_type?,
                                      skills[],domains[],badge?,vehicle_type?,id_file_name?} -> helper
GET    /auth/me                      (Bearer token) -> helper
GET    /helpers/{id}   PATCH /helpers/{id}   {available?,name?,lat?,lng?,blood_type?,skills?,domains?}
POST   /helpers/{id}/device-tokens   {platform,token}
ALIASES (keep working): POST /auth/request-otp == /auth/send-otp
```

### Zones / misc
```
POST   /zone-reports  GET /zone-reports  GET /confirmed-zones
GET    /zone-reports/sachet-alerts
POST   /debug/reseed-demo            (demo reset)
GET    /health   GET /ws/stats   GET /events/contract
```

## 4. WebSocket — BOTH schemes must work

The co-dev's React components use path-based channels; Flutter and the
multiplexed client use query-param channels. The backend supports both.

```
Multiplexed (canonical):  ws://host/ws?channels=global,request:<id>,match:<id>,incident:<id>
Path-based (compat):      ws://host/ws/{channel_type}/{channel_id}
   /ws/request/{id}  /ws/match/{id}  /ws/incident/{id}
   /ws/admin/{any}   /ws/zones/{any}  /ws/volunteers/{any}   -> all map to "global"
```

Envelope — the server sends **both** key names so either client works:
```json
{ "event": "...", "channel": "...", "payload": {...}, "data": {...}, "ts": "iso8601" }
```
`payload` and `data` are the same object. New clients read `payload`.

Events: `new_request`, `matched`, `status_update`, `new_message`,
`zone_confirmed`, `incident_update`.

`status_update` payload arrives in one of three shapes — handle all:
a bare request row, `{request, match, helper}`, or `{match, request}`.

## 5. File ownership — DO NOT edit files you don't own

**Orchestrator-owned — READ ONLY. Do not edit. Request changes in your report:**
```
backend/schema.sql   backend/app/{config,schemas,events,db,ws,main}.py
docs/INTEGRATION-CONTRACT.md
```
These are already migrated and verified for v2: `service_details`,
`voice_note_url`, `proof_video_url`, `verification_status`,
`verification_reasons`, `incident_id`, `severity_class`, `offline_created_at`
on `requests`; `email/darpan_id/skills/domains/badge/vehicle_type/
id_file_name/blood_type` on `helpers`; the `incidents` table; the dual-key WS
envelope; and the path-based `/ws/{type}/{id}` compat route. Both WS schemes
are confirmed working against one shared ConnectionManager.

**APPEND-ONLY shared client files.** More than one agent needs these. You may
**ADD** new methods/models to the end of the relevant section. You may **NOT**
modify, rename, reorder, or delete anything already present, and you may not
reformat the file. Keep additions small and clearly grouped under a comment
naming your workstream.
```
frontend/src/services/api.js          frontend/src/services/websocket.js
volunteer_app/lib/api.dart            volunteer_app/lib/models.dart
volunteer_app/lib/app_state.dart      volunteer_app/lib/main.dart
```

| Agent | Owns (create/edit freely) |
|---|---|
| **BE-CRITICAL** | `backend/app/routers/{sos,incidents}.py`, `backend/app/incident_status.py`, `backend/tests/test_critical_flow.py` |
| **BE-NONCRITICAL** | `backend/app/routers/{requests,auth,helpers,matches,messages}.py`, `backend/app/{verification,blood}.py`, `backend/tests/test_noncritical_flow.py` |
| **WEB-CRITICAL** | `frontend/src/components/Critical/**`, `frontend/src/utils/offlineSos.js` |
| **WEB-NONCRITICAL** | `frontend/src/components/{Requester,Admin,Auth}/**`, `frontend/src/utils/bloodCompatibility.js`, `frontend/src/App.jsx`, `frontend/src/components/Header.jsx` |
| **FL-CRITICAL** | `volunteer_app/lib/screens/critical/**`, `volunteer_app/lib/{sos_service,offline_queue}.dart` |
| **FL-NONCRITICAL** | `volunteer_app/lib/screens/**` (except `critical/`), `volunteer_app/lib/{haptics,notifications,deep_links,shake,geo,session}.dart` |

## 6. Verification rules (BE-NONCRITICAL implements; everyone displays)

Rule-based, not ML — the spec is explicit that believable text is not
evidence. Run on create, in this order:
1. **Duplicate** — same category, active, within 150 m / 90 min → link to
   root via `linked_request_id`, `verification_status='rejected'`,
   reasons `["duplicate"]`. Root gets a bumped `linked_count`.
2. **Completeness** — missing any `REQUIRED_SERVICE_FIELDS` → `'incomplete'`,
   reasons `["missing_field:<name>", ...]`.
3. **Evidence** — has `photo_url` OR `proof_video_url` OR `requester_phone`
   OR submitted by a verified helper → `'verified'`. Otherwise `'pending'`
   with `["no_evidence_signal"]` (awaits human review; never auto-verified
   from text alone).

Only `verification_status IN ('verified','pending')` requests are broadcast
to responders. `rejected`/`incomplete` are not fanned out as `new_request`.

## 7. Definition of done (every agent)

- Your code runs. Backend: endpoints return correct shapes, verified with
  real calls. Frontend: `npm run build` passes. Flutter: `flutter analyze`
  is clean and `flutter build ios --debug --simulator` succeeds.
- You wrote/extended a test or a verification script that actually executes
  and prints pass/fail — not a claim that it works.
- You did not edit another agent's files or the orchestrator-owned files.
- Your final report lists: what you built, what you verified and how, what
  you could NOT do, and any contract change you need.
