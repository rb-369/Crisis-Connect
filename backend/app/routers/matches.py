"""Match lifecycle: En Route -> Arrived -> Resolved.

The match status and the request status are kept in step, because the requester
(React) watches the request's 5-state lifecycle while the volunteer (Flutter)
drives the 3-state match one:

    match en_route / arrived  ->  request in_progress
    match resolved            ->  request resolved
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import db, events, incident_status, serialize
from ..ids import parse_uuid
from ..schemas import MatchStatusPatch
from ..ws import manager

log = logging.getLogger("crisisconnect.matches")
router = APIRouter(tags=["matches"])

MATCH_JOIN_SQL = """
select m.*,
       h.name     as helper_name,
       h.phone    as helper_phone,
       h.role     as helper_role,
       h.org_name as helper_org,
       r.category  as request_category,
       r.urgency   as request_urgency,
       r.status    as request_status,
       r.lat       as request_lat,
       r.lng       as request_lng,
       r.details   as request_details,
       r.requester_name  as requester_name,
       r.requester_phone as requester_phone,
       r.zone_confirmed  as request_zone_confirmed,
       r.incident_id     as request_incident_id
  from matches m
  join helpers  h on h.id = m.helper_id
  join requests r on r.id = m.request_id
"""

REQUEST_STATUS_FOR_MATCH = {
    "en_route": "in_progress",
    "arrived": "in_progress",
    "resolved": "resolved",
}


@router.get("/matches/{match_id}")
async def get_match(match_id: str):
    row = await db.fetchrow(
        MATCH_JOIN_SQL + " where m.id = $1", parse_uuid(match_id, "match_id"))
    if row is None:
        raise HTTPException(404, "match not found")
    return serialize.row(row)


@router.get("/requests/{request_id}/match")
async def get_match_for_request(request_id: str):
    row = await db.fetchrow(
        MATCH_JOIN_SQL + " where m.request_id = $1",
        parse_uuid(request_id, "request_id"))
    if row is None:
        raise HTTPException(404, "no match for that request")
    return serialize.row(row)


@router.patch("/matches/{match_id}")
async def patch_match(match_id: str, body: MatchStatusPatch):
    """Advance the match. Broadcasts `status_update` to both sides."""
    mid = parse_uuid(match_id, "match_id")

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            current = await conn.fetchrow(
                "select * from matches where id = $1 for update", mid)
            if current is None:
                raise HTTPException(404, "match not found")
            if current["status"] == "resolved" and body.status != "resolved":
                # A resolved job doesn't reopen -- otherwise a stale phone
                # replaying its last tap could un-resolve a finished rescue.
                return JSONResponse(status_code=409, content={
                    "code": "already_resolved",
                    "detail": "This match is already resolved.",
                    "match_id": str(mid),
                    "current_status": current["status"],
                })

            match = await conn.fetchrow(
                "update matches set status = $2 where id = $1 returning *",
                mid, body.status)
            request = await conn.fetchrow(
                """
                update requests
                   set status = $2, updated_at = now()
                 where id = $1
                returning *
                """,
                current["request_id"], REQUEST_STATUS_FOR_MATCH[body.status],
            )

            # Critical incidents (docs/AGENT-FLOW.md section 2A): a linked
            # request's responder reaching en_route/arrived is what "on the
            # way" means at the incident level.
            incident_out = None
            if request["incident_id"] is not None:
                if body.status in ("en_route", "arrived"):
                    advanced = await incident_status.advance(
                        conn, request["incident_id"], "on_the_way")
                    if advanced is not None:
                        incident_out = serialize.row(advanced)
                elif body.status == "resolved":
                    advanced = await incident_status.maybe_auto_resolve(
                        conn, request["incident_id"])
                    if advanced is not None:
                        incident_out = serialize.row(advanced)

    joined = serialize.row(await db.fetchrow(MATCH_JOIN_SQL + " where m.id = $1", mid))
    payload = {"match": joined, "request": serialize.row(request)}

    # Volunteer's own screen + the chat pair.
    await manager.broadcast(events.match_channel(mid), events.STATUS_UPDATE, payload)
    # The requester's live status view (React).
    await manager.broadcast(
        events.request_channel(current["request_id"]), events.STATUS_UPDATE, payload)
    # Admin dashboard / other feeds.
    await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, payload)
    if incident_out is not None:
        await manager.broadcast(
            events.incident_channel(incident_out["id"]), events.INCIDENT_UPDATE, incident_out)
        await manager.broadcast(events.GLOBAL, events.INCIDENT_UPDATE, incident_out)
    # PUSH: candidate trigger -- e.g. "your helper marked arrived" while the
    # requester's tab/app isn't foregrounded. Undecided -- see
    # docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md.

    log.info("match %s -> %s (request -> %s)",
             mid, body.status, REQUEST_STATUS_FOR_MATCH[body.status])
    return payload


@router.get("/helpers/{helper_id}/matches")
async def helper_matches(helper_id: str,
                         status: str | None = Query(default=None),
                         limit: int = Query(100, gt=0, le=500)):
    """A volunteer's matches -- the app's history screen (Step 10)."""
    hid = parse_uuid(helper_id, "helper_id")
    rows = await db.fetch(
        MATCH_JOIN_SQL + """
         where m.helper_id = $1
           and ($2::text is null or m.status = $2)
         order by m.matched_at desc
         limit $3
        """,
        hid, status, limit,
    )
    return serialize.rows(rows)
