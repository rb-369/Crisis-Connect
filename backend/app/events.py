"""Shared WebSocket contract. Dev A (React) and Dev B (Flutter) both code
against exactly these names -- this file is the single source of truth.

CHANNELS
  "global"                -> new_request, zone_confirmed, incident_update
                             (volunteer feed + map + admin dashboard)
  "request:{requestId}"   -> matched, status_update        (requester's own view)
  "match:{matchId}"       -> new_message, status_update    (the matched pair)
  "incident:{incidentId}" -> incident_update                (one incident's own feed)

ENVELOPE (every server -> client frame)
  {"event": "<name>", "channel": "<channel>", "payload": {...}, "ts": "<iso8601>"}

CLIENT -> SERVER control frames (optional; channels can also be given in the
query string as /ws?channels=global,request:abc)
  {"action": "subscribe",   "channels": ["request:abc"]}
  {"action": "unsubscribe", "channels": ["request:abc"]}
  {"action": "ping"}                      -> server replies {"event": "pong"}
"""

# --- event names ---
NEW_REQUEST = "new_request"
MATCHED = "matched"
STATUS_UPDATE = "status_update"
NEW_MESSAGE = "new_message"
ZONE_CONFIRMED = "zone_confirmed"
INCIDENT_UPDATE = "incident_update"

ALL_EVENTS = {
    NEW_REQUEST, MATCHED, STATUS_UPDATE, NEW_MESSAGE, ZONE_CONFIRMED, INCIDENT_UPDATE,
}

# --- channel builders ---
GLOBAL = "global"


def request_channel(request_id) -> str:
    return f"request:{request_id}"


def match_channel(match_id) -> str:
    return f"match:{match_id}"


def incident_channel(incident_id) -> str:
    return f"incident:{incident_id}"
