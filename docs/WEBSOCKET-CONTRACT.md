# CrisisConnect — WebSocket contract (shared: Dev A + Dev B)

Step 0 deliverable. **This is the single source of truth.** The backend serves
the same thing at `GET /events/contract`, and it is mirrored in code at
`backend/app/events.py` and `volunteer_app/lib/ws.dart`. If you change a name,
change it in all three.

## Connecting

    ws://<host>/ws?channels=global
    ws://<host>/ws?channels=global,request:<uuid>,match:<uuid>

One socket can carry many channels. On connect the server sends:

```json
{"event":"subscribed","channel":null,"payload":{"connection_id":"a1b2c3d4","channels":["global"]},"ts":null}
```

## Channels

| Channel | Events carried | Who listens |
|---|---|---|
| `global` | `new_request`, `zone_confirmed`, `matched`, `status_update` | Volunteer feed (Flutter), admin dashboard (React) |
| `request:{request_id}` | `matched`, `status_update` | The requester's live status view (React) |
| `match:{match_id}` | `new_message`, `status_update` | The matched pair — chat + progress |

## Envelope

Every server→client frame:

```json
{ "event": "<name>", "channel": "<channel>", "payload": { }, "ts": "<iso8601>" }
```

## Events

### `new_request` — channel `global`
Payload is the full request row (`id, category, urgency, status, lat, lng,
admin_status, zone_confirmed, linked_request_id, linked_count, created_at, …`).

**Only fired for non-duplicate requests.** A request detected as a duplicate
does *not* fire `new_request` — it fires `status_update` on the root instead
(see below), so it never appears as a second card in the feed.

### `matched` — channels `request:{id}` **and** `global`
```json
{ "request": { }, "match": { }, "helper": { "id":"…","name":"…","role":"volunteer","org_name":null,"phone":"…" } }
```
* On `request:{id}` — the requester learns who is coming.
* On `global` — other volunteers' feeds drop the request that was just taken.

### `status_update` — channels vary
Two shapes, both possible:
1. **Bare request row** — an admin approve/reject/flag, or a duplicate-counter
   bump. Read `payload` directly.
2. **`{match, request}`** — a match transition (`en_route`/`arrived`/`resolved`).
   Read `payload.request` / `payload.match`.

Clients must handle both: `payload.request ?? payload`.

### `new_message` — channel `match:{match_id}`
Payload is the message row: `{id, match_id, sender_id, body, sent_at}`.

### `zone_confirmed` — channel `global`
```json
{ "zone": { "id":"…","category":"flood","center_lat":12.97,"center_lng":77.59,"confirmed_at":"…" },
  "cluster_count": 3,
  "requests_badged": ["<request uuid>", "…"] }
```
`requests_badged` are the requests whose `zone_confirmed` just flipped to true —
each also gets a `status_update` on its own `request:{id}` channel.

## Client → server control frames

```json
{"action":"subscribe","channels":["request:abc"]}
{"action":"unsubscribe","channels":["request:abc"]}
{"action":"ping"}
```
Replies: `subscribed`, `unsubscribed`, `pong`. Unknown action → `error`.

## Testing a subscription

`POST /debug/broadcast` fires an arbitrary event at any channel — use it to
smoke-test a client without staging real data:

```json
{ "channel": "global", "event": "new_request", "payload": { "id": "test" } }
```

`GET /ws/stats` shows the live connection/channel registry.
