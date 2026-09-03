# CrisisConnect — Merge Status & Plan (post-Antigravity verification)

**How this document was produced:** every claim below was checked by actually
running the command shown, not by reading code and assuming it works. Where
the changelog you pasted claimed something ("2/2 tests passed", "0 errors",
"No issues found"), that claim was independently re-verified here — in one
case it turned out to be stale (a test now fails that didn't before), in two
cases it was confirmed genuinely true.

**No code was changed while producing this document.** Everything under
"What's to be done" is a recommendation, not an action taken.

**Top-line severity, across all three areas:** one **critical, whole-app-breaking
bug** (Flutter cannot log in — see Backend §1), one **silent regression** in an
existing test, one **real logic bug** in Flutter (wrong ID passed to an
endpoint), and several **incomplete contract items** that don't break anything
but leave planned features half-wired. Nothing here requires a rewrite —
most fixes are small and localized, listed precisely below.

---

# PART 1 — BACKEND

## Verified working (ran the actual command, saw the actual result)

- **Server boots and is healthy**: `curl localhost:8000/health` → `{"status":"ok","db":true}`.
- **Critical/incident flow, real end-to-end**: `pytest tests/test_critical_flow.py` → **PASSED**. Confirmed for real: `POST /sos` creates an incident, `GET /incidents/{id}/responders` returns an escalating-radius search result, `POST /incidents/{id}/assessment` advances status to `assessed`, `GET /incidents/{id}/timeline` returns an ordered history including `sos_triggered` and `assessed`.
- **`incident_status.py` (BE-CRITICAL's shared module) is genuinely well-built**: single atomic `UPDATE ... WHERE <rank-case> < $rank` guard for status advancement (no read-then-write race), a `record_event()` hook that writes the timeline automatically on every real transition, and a `maybe_auto_resolve()` that correctly no-ops until every linked request is terminal. Read the full source; the reasoning holds up.
- **`maybe_auto_resolve` is correctly wired everywhere BE-CRITICAL's own report said it needed to be**: confirmed by grep + reading the actual call sites —
  - `requests.py` line 451 (`patch_request`, admin forcing resolved/expired) and line 552 (`resolve_request`, requester self-resolve)
  - `matches.py` (inside `patch_match`, when `body.status == "resolved"`)
  - `expiry.py` (`_sweep_once`, for every row the sweep expires)
- **Escalating responder search is real**: `INCIDENT_SEARCH_RADII_M = [5_000, 10_000, 25_000]` in `incidents.py`, widens until `min_responders` found or the ladder is exhausted, returns the radius actually used. Matches the flowchart's "default ~5km, able to increase" requirement.
- **`incident_events` table exists and is populated** (`\d incident_events` confirms columns `id, incident_id, status, created_at` with a FK to `incidents` and an index on `(incident_id, created_at)`).
- **Verification pipeline logic is intact and correctly renamed**: `verification.py` still implements the exact 3-rule order from the contract (duplicate → incomplete → evidence/pending/verified), now reading `service_details` (renamed from `structured_details` throughout, confirmed by grep — no leftover references to the old name in Python).
- **Frontend build against this backend passes** (see Part 2) and a live click-through produced zero console errors.
- **Flutter `flutter analyze` and `flutter build ios --debug --simulator` both genuinely pass** against this backend's contract (see Part 3) — the backend's shape changes didn't break Flutter's *compile*, only its *runtime* auth calls (see §1 below).

## BROKEN — needs fixing

### 1. Flutter cannot log in. This is the most severe issue found. (backend `app/routers/auth.py`, backend `app/schemas.py`)

The auth router was fully rewritten to the co-dev's `{contact, otp_code, role}`
shape. The contract explicitly said *"Keep the existing `/auth/request-otp`
working as an alias — Flutter depends on it"* — the **path** was kept as an
alias (`@router.post("/request-otp")` stacked on the same handler as
`/send-otp`), but the **request/response shape** was not, so the alias is
alias-in-name-only.

Reproduced directly against the live server with Flutter's exact payload:
```
POST /auth/request-otp  {"phone":"...","role":"volunteer","name":"..."}
→ 422 {"detail":[{"loc":["body","contact"],"msg":"Field required"}]}

POST /auth/verify-otp   {"phone":"...","code":"123456"}
→ 422 {"detail":[{"loc":["body","contact"],...},{"loc":["body","otp_code"],...}]}
```
`volunteer_app/lib/api.dart` (`requestOtp`, `verifyOtp`) sends exactly these
old-shape payloads and was never updated. **Every Flutter user is stuck on
the login screen right now** — nothing downstream (availability toggle,
feed, accept, chat, assessment) is reachable without a session.

**Fix (backend, smallest safe change):** in `send_otp` and `verify_otp`,
accept `contact` OR `phone`, and `otp_code` OR `code`, as aliases of the same
field (Pydantic `Field(validation_alias=AliasChoices(...))` or a simple
`model_validator` that copies `phone`→`contact` / `code`→`otp_code` before
validation). Do this rather than changing Flutter, since the co-dev's React
app is already live on the new shape and re-breaking that would trade one
outage for another.

### 2. `test_volunteer_api.py` now fails — direct consequence of #1

`./tests/run_all.sh` → `test_volunteer_api`: 4 failures, all cascading from
`POST /auth/request-otp` returning 422 instead of 200. This is the same bug
as #1, just surfacing through the older test suite. Fixing #1 fixes this
automatically — no separate work needed.

### 3. `test_agent_flow.py` now crashes outright (test infra, not app logic)

```
asyncpg.exceptions.ForeignKeyViolationError: update or delete on table "incidents"
violates foreign key constraint "incident_events_incident_id_fkey"
DETAIL: Key (id)=(...) is still referenced from table "incident_events".
```
The test's cleanup step (`delete from incidents`) was written before
`incident_events` existed. BE-CRITICAL's own report flagged that
`expiry.py`'s ownership is ambiguous in the contract table — this is the
same kind of gap: a new table was added (correctly, and exactly where the
contract said schema changes needed documenting) but the *existing test
file* that predates it wasn't updated to also clean up
`incident_events` first.

**Fix:** in `test_agent_flow.py`'s cleanup block, add
`await conn.execute("delete from incident_events")` before
`await conn.execute("delete from incidents")`.

### 4. `test_noncritical_flow.py` fails on a fresh run (test correctness, not app logic)

```
AssertionError: assert 'rejected' == 'pending'
```
This new test has no data-cleanup step, unlike every other test file in
`tests/` (which all truncate/delete their own rows first specifically so
re-runs are deterministic). Run twice in a row, or run after
`test_agent_flow.py` has left rows at the same lat/lng, and the duplicate
check correctly fires — the app is behaving correctly, the test isn't
isolated. The changelog's "2/2 passed" was true for one specific run order,
not reliably.

**Fix:** add a cleanup step (delete rows by a distinctive
`requester_device_id` prefix, or use a unique lat/lng per run) matching the
pattern already established in every other test file.

### 5. `test_ws_manager.py`'s envelope-shape assertion is now stale (test correctness)

```
[FAIL] envelope shape is {event,channel,payload,ts}
```
This is an intentional consequence of the dual-envelope change made to
support the co-dev's `data`-keyed WS client (`ws.py` now sends both
`payload` and `data` in every frame — confirmed working correctly for both
client generations). The test's `set(frame) == {"event","channel","payload","ts"}`
assertion was never updated for the new 5-key shape. Not an app bug.

**Fix:** update that one assertion to
`{"event","channel","payload","data","ts"}`.

*(Separately, the same suite's exact-connection-count assertions show
7-8 failures whenever a live browser tab or the Flutter app has an open
WS connection to this same server — confirmed via `curl localhost:8000/ws/stats`
showing exactly the extra count. This is the known, previously-documented
artifact, not a regression — mentioned here only so it isn't confused with
the real issues above.)*

## Contract items assigned to BE-NONCRITICAL that were NOT done

- **Richer accept payload.** Contract asked for `POST /requests/{id}/accept`
  to accept `{helper_id, helper_name?, helper_phone?, helper_role?,
  blood_group?, helper_lat?, helper_lng?}` (the co-dev's shape) and upsert
  the extra fields onto the helper row. `schemas.py`'s `AcceptBody` still
  only has `helper_id`. The atomic-accept race safety itself is untouched
  (verified: `test_atomic_accept.py` still 21/21) — this is a missing
  feature, not a broken one.
- **Requirement-based matching endpoint** (`GET /requests/{id}/matched-responders`
  for non-blood categories via `helpers.skills`/`domains`) — not found anywhere
  in `requests.py`. Only the blood-specific `GET /requests/{id}/compatible-donors`
  (built earlier, before this round) exists.
- **`proof_video_url` as a verification evidence signal** — `verification.py`'s
  `verify()` signature only checks `photo_url`/`requester_phone`; the video
  field isn't passed in or checked, even though the column exists and
  `RequestCreate` accepts it.
- **`PATCH /helpers/{id}` doesn't accept `skills`/`domains`** — only
  `available/name/lat/lng/blood_type`. A helper can set these at
  registration (`POST /auth/helpers`) but never update them afterward.
- **`reopen_reason` is not persisted.** `POST /requests/{id}/reopen` puts
  `body.reason` into the *response* dict only (`out["reopen_reason"] = body.reason`)
  — there's no `reopen_reason` column, so a later `GET /requests/{id}` loses it.
  Minor, but worth either adding the column or documenting that it's
  transient.

---

# PART 2 — FRONTEND (React web)

## Verified working

- **`npm run build` passes cleanly** — real output: `✓ 1549 modules transformed`,
  built in 4.08s, only a (pre-existing, cosmetic) chunk-size warning.
- **Live click-through, zero console errors** (`read_console_messages` came
  back empty on both the requester screen and the admin dashboard).
- **The critical/non-critical split is correctly wired and visually
  distinct**: loaded the actual page and confirmed via `get_page_text` — the
  SOS block shows exactly 5 critical categories (Fire/Flood/Earthquake/
  Accident/Trapped-Rescue) with "CRITICAL 1-TAP" badges, and the grid below
  shows exactly the 6 non-critical categories. `InstantReport.jsx` imports
  `SosButton` from `../Critical/SosButton` (not the older, unused copy — see
  below) and `NonCriticalRequestModal` from the same directory — both real,
  both mounted, both rendering.
- **`App.jsx` correctly imports and mounts `SosStatusView` and
  `MultiStepAuthModal`** from their respective owned directories (confirmed
  by grep on the actual import lines and JSX usage).
- **`api.js`'s append-only rule was honored.** Read the full current file:
  every pre-existing method is untouched; the new auth/helper/reopen methods
  are appended at the bottom under a clearly labeled comment block, using
  distinct names (`sendOtp`, `verifyOtpV2`, `login`, etc.) that don't collide
  with the pre-existing `requestOtp`/`verifyOtp` a different utility already
  depends on. This is exactly the discipline the contract asked for.
- **Dual WS envelope confirmed working from the browser's own client**: no
  parse errors, live SOS status view updates rendered without a page reload
  during the earlier verification pass this session.

## Dead code (harmless, but worth knowing about)

`frontend/src/components/Requester/SosButton.jsx` and
`SosStatusView.jsx` still exist on disk — these are an **earlier,
now-unused version** (mine, from before this round). Confirmed via grep that
nothing imports from `Requester/SosButton` or `Requester/SosStatusView`;
everything correctly points at `Critical/SosButton` and
`Critical/SosStatusView` instead. Not a bug, just clutter — safe to delete
whenever convenient.

## NOT done — the verification pipeline is invisible to every user

`grep -rn "verification_status" frontend/src/` returns **zero matches**,
anywhere in the entire frontend. The backend computes and returns
`verification_status` (`pending`/`incomplete`/`verified`/`rejected`) and
`verification_reasons` (e.g. `["missing_field:hospital_name"]`) on every
non-critical request — none of it is read or displayed:

- **`NonCriticalRequestModal.jsx`** doesn't show the result after submitting
  — a requester who submits an incomplete blood request gets no feedback
  that anything's missing.
- **`AdminDashboard.jsx`** has no verification-status badge or filter tab —
  confirmed live in the browser: the queue shows only the pre-existing
  `ADMIN: PENDING/FLAGGED` triage badges, nothing about verification at all.

This was an explicit contract item for WEB-NONCRITICAL and is the single
biggest visible gap on the web side. It's also the one that makes the
flowchart's "Verification Decision" box (§5) invisible in the actual product
— right now a rejected/incomplete request looks identical to a verified one
to anyone using the app.

**Fix (moderate, not small):** in `NonCriticalRequestModal.jsx`'s submit
handler, branch on the response's `verification_status` and show a
result state (`incomplete` → list the `missing_field:*` reasons and let the
user fill them in via the existing enrich endpoint; `rejected` with
`duplicate` → point at the existing request instead). In
`AdminDashboard.jsx`, add a verification badge next to the existing
admin-status badge and a filter tab for each of the 4 states.

---

# PART 3 — FLUTTER (volunteer app)

## Verified working

- **`flutter analyze` → "No issues found!"** — ran it directly, genuinely
  clean, zero issues.
- **`flutter build ios --debug --simulator` → succeeds**, real Xcode build,
  63.8s, `✓ Built build/ios/iphonesimulator/Runner.app`. The two new native
  packages (`url_launcher ^6.3.2`, `connectivity_plus ^7.3.1`) integrate
  without breaking the build — this was the actual risk with adding
  native-code packages, and it held up.
- **`incident_status.py`'s shared logic is mirrored reasonably on the
  Flutter side conceptually** (assessment form fields match the backend's
  `IncidentAssessment` schema one-for-one: people/injuries/trapped counts,
  4 boolean flags, notes).
- **`offline_queue.dart` and `sos_service.dart` exist and read cleanly** —
  `SosService` takes an `Api` instance (matches the app's existing DI
  pattern), and the queue persistence approach mirrors the pattern already
  established in `shared_preferences`-based code elsewhere in the app.

## BROKEN

### Login is broken here too, for the exact same reason as backend §1

`api.dart`'s `requestOtp`/`verifyOtp` send `{phone, ...}` / `{phone, code}`.
Confirmed by reading the actual code — never updated for the new backend
shape. This is the *same* underlying issue as Backend §1; fixing the
backend to accept both field names fixes Flutter automatically, no Dart
change needed.

### `IncidentAssessmentScreen` is wired to the wrong ID — will 404 or hit the wrong incident

In `screens/status_screen.dart`:
```dart
onPressed: () => Navigator.of(context).push(MaterialPageRoute(
  builder: (_) => IncidentAssessmentScreen(incidentId: _match.requestId),
)),
```
`_match.requestId` is a **request** ID; `IncidentAssessmentScreen` expects
an **incident** ID (a different UUID, in a different table). Confirmed the
`Match` model (`lib/models.dart`) doesn't even carry an `incidentId` field —
the backend's own `MATCH_JOIN_SQL` (in `matches.py`, backend-owned, not
edited this round) doesn't select `r.incident_id` either, so there's
currently no path to the real value without a small backend change too.

The button also appears **unconditionally** on every match, including plain
non-critical ones (blood, oxygen, etc.) that have no incident at all —
tapping "Assess Incident" on a blood-donor match would call
`POST /incidents/{that request's id}/assessment`, which will 404 against a
real incident (or, worse, silently succeed against some *unrelated*
incident if a UUID collision were ever possible — it isn't here, but the
shape of the bug is "wrong ID," which is the class of bug worth taking
seriously).

**Fix (three small, localized changes):**
1. Backend: add `r.incident_id as request_incident_id` to `MATCH_JOIN_SQL`
   in `matches.py` (backend-owned file — flagging for whoever picks this up).
2. Flutter: add `final String? requestIncidentId;` to `Match` in
   `models.dart`, parsed from that new field.
3. Flutter: in `status_screen.dart`, only show the "Assess Incident" button
   `if (_match.requestIncidentId != null)`, and pass
   `incidentId: _match.requestIncidentId!`.

## Contract items assigned to Flutter that were NOT done

- **`sos_screen.dart`, `incident_feed_screen.dart`, `incident_detail_screen.dart`**
  — none of these exist. Only `incident_assessment_screen.dart` was built.
  There is currently **no SOS trigger UI in the Flutter app at all** (no
  "big red button" for a volunteer to raise their own SOS) and **no
  incident-feed/detail screen** for a responder to browse active incidents
  by priority. `sos_service.dart` and `offline_queue.dart` exist as
  *services* but have no screen calling them — confirmed by grep, they're
  referenced nowhere outside their own files and `api.dart`'s comments.
- **Requester-side non-critical request creation in Flutter** — not found.
  The volunteer app still has no category picker / `service_details` form;
  the flowchart's non-critical flow only exists on the web.
- **Verification-status display in Flutter** — same gap as the web side,
  confirmed absent by grep.
- **Multi-step volunteer/NGO onboarding matching the co-dev's web modal** —
  `onboarding_screen.dart` exists and covers blood group / vehicle type /
  skills, but is **not reachable from anywhere** (confirmed via grep: no
  screen navigates to `OnboardingScreen`; `main.dart`'s routing is unchanged
  from before this round — still only `HomeScreen`/`LoginScreen`). It's
  built but orphaned.
- **Blood-donor matching screen, resolution-confirm/reopen UI, voice notes,
  haptics call-sites** — none found in the current Flutter tree.

## `main.dart` — unchanged

Read the full file: identical to before this round of work. No new screen
is registered for navigation anywhere except the one (buggy) call site in
`status_screen.dart`. Every other new file (`OnboardingScreen`, `SosScreen`
if it existed, `SosService`, `offline_queue.dart`) is currently dead code
from the standpoint of an actual user tapping through the app.

---

# Summary — what to prioritize, in order

1. **Fix the auth shape mismatch** (backend, accept both field-name sets).
   This single fix unblocks Flutter's login, which unblocks everything
   downstream in Flutter, and also fixes `test_volunteer_api.py`.
2. **Fix `IncidentAssessmentScreen`'s wrong-ID bug** (3 small changes across
   backend + Flutter, listed above).
3. **Fix the two test-suite issues** (`test_agent_flow.py`'s missing
   `incident_events` cleanup, `test_noncritical_flow.py`'s missing data
   isolation, `test_ws_manager.py`'s stale envelope-shape assertion) — cheap,
   restores a trustworthy regression gate.
4. **Wire `main.dart` navigation** so `OnboardingScreen` is reachable (e.g.
   from `LoginScreen` after a new-user OTP verify) — otherwise it's built
   for nothing.
5. **Build the three missing Flutter critical screens** (SOS trigger,
   incident feed, incident detail) — this is the biggest single remaining
   gap: the flowchart's entire critical flow has no Flutter entry point.
6. **Surface `verification_status` in both web and Flutter** — moderate
   effort, but it's the only way the flowchart's "Verification Decision"
   step (§5) is visible to an actual user instead of only existing in the
   database.
7. Smaller items: richer accept payload, requirement-based matching
   endpoint, `proof_video_url` as an evidence signal, `PATCH /helpers`
   accepting skills/domains, persisting `reopen_reason`.
