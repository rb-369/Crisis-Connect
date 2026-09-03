"""Request lifecycle endpoints.

The accept endpoint here is the single most important query in the app --
see `accept_request` for why it is shaped the way it is.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from .. import blood, config, db, events, incident_status, serialize, verification
from ..ids import parse_uuid
from ..schemas import AcceptBody, RequestAdminPatch, RequestCreate, RequestEnrich, RequestReopen
from ..ws import manager

log = logging.getLogger("crisisconnect.requests")
router = APIRouter(tags=["requests"])


# ---------------------------------------------------------------------------
# Create  (Dev A's surface; duplicate detection is layered on in Step 4)
# ---------------------------------------------------------------------------
# Urgency is stored as text, so ordering needs an explicit rank. Kept as one
# constant so the admin queue and the volunteer feed can never sort differently.
URGENCY_ORDER_SQL = """
case r.urgency
  when 'critical' then 3
  when 'high'     then 2
  when 'normal'   then 1
  else 0
end
"""


# ---------------------------------------------------------------------------
# STEP 4 -- Duplicate detection.
# Same category, within DUPLICATE_RADIUS_M and DUPLICATE_WINDOW_MIN of an
# existing *active* request => the new row is linked to that one instead of
# being treated as a fully independent emergency.
#
# `coalesce(linked_request_id, id)` resolves to the ROOT of an existing chain,
# so a third near-identical request links to the original rather than to the
# second one. That keeps the "N people also need this here" counter a simple
# count of direct children instead of a recursive walk.
# ---------------------------------------------------------------------------
DUPLICATE_SQL = """
select coalesce(r.linked_request_id, r.id) as root_id
  from requests r
 where r.category = $1
   and r.status not in ('resolved', 'expired')
   and r.created_at >= now() - ($2::int * interval '1 minute')
   and earth_distance(ll_to_earth(r.lat, r.lng), ll_to_earth($3, $4)) <= $5::float8
 order by r.created_at asc
 limit 1
"""

# PRD: a request raised inside an already-Confirmed Zone is badged "likely
# genuine -- area confirmed". Zones are matched on location only; zone
# categories are a different vocabulary to request categories.
IN_ZONE_SQL = """
select exists (
  select 1 from confirmed_zones z
   where z.confirmed_at >= now() - ($3::int * interval '1 minute')
     and earth_distance(ll_to_earth(z.center_lat, z.center_lng),
                        ll_to_earth($1, $2)) <= $4::float8
)
"""

# PRD Layer 2, second half: a request far from EVERY confirmed zone is
# flagged for extra admin scrutiny (not auto-rejected). Only fires once
# zones exist at all -- with none yet there's nothing to correlate against,
# and flagging every request before the first zone confirms would be absurd.
FAR_FROM_ALL_ZONES_SQL = """
select exists (select 1 from confirmed_zones)
   and not exists (
         select 1 from confirmed_zones z
          where earth_distance(ll_to_earth(z.center_lat, z.center_lng),
                               ll_to_earth($1, $2)) <= $3::float8
       )
"""

WITH_LINKED_COUNT_SQL = """
select r.*,
       (select count(*) from requests d where d.linked_request_id = r.id) as linked_count
  from requests r where r.id = $1
"""


@router.post("/requests", status_code=201)
async def create_request(body: RequestCreate):
    urgency = body.urgency or (
        "high" if body.category in config.HIGH_URGENCY_CATEGORIES else "normal"
    )

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            # Serialise creation per category so two simultaneous near-identical
            # requests can't both conclude "no duplicate exists" and land as two
            # independent emergencies. Same race class as the accept endpoint.
            # Held for the length of one insert; request volume here is tiny.
            await conn.execute(
                "select pg_advisory_xact_lock(hashtext($1))", f"req:{body.category}")

            in_zone = await conn.fetchval(
                IN_ZONE_SQL, body.lat, body.lng,
                config.ZONE_DEDUPE_WINDOW_MIN, float(config.ZONE_RADIUS_M),
            )
            far_from_zones = False
            if not in_zone:
                far_from_zones = await conn.fetchval(
                    FAR_FROM_ALL_ZONES_SQL, body.lat, body.lng,
                    float(config.FAR_ZONE_RADIUS_M),
                )
            admin_status = "flagged" if far_from_zones else "pending"

            dup = await conn.fetchrow(
                DUPLICATE_SQL, body.category, config.DUPLICATE_WINDOW_MIN,
                body.lat, body.lng, float(config.DUPLICATE_RADIUS_M),
            )
            linked_to = dup["root_id"] if dup is not None else None

            verification_status, verification_reasons = verification.verify(
                body.category, body.service_details, body.photo_url,
                body.requester_phone, is_duplicate=linked_to is not None,
                proof_video_url=body.proof_video_url,
            )

            row = await conn.fetchrow(
                """
                insert into requests (category, urgency, lat, lng, requester_device_id,
                                      requester_name, requester_phone, details,
                                      photo_url, zone_confirmed, linked_request_id,
                                      admin_status, severity_class, service_details,
                                      verification_status, verification_reasons,
                                      voice_note_url, proof_video_url)
                values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'non_critical',$13,$14,$15,$16,$17)
                returning *
                """,
                body.category, urgency, body.lat, body.lng, body.requester_device_id,
                body.requester_name, body.requester_phone, body.details,
                body.photo_url, bool(in_zone), linked_to, admin_status,
                body.service_details, verification_status, verification_reasons,
                body.voice_note_url, body.proof_video_url,
            )

            root = None
            if linked_to is not None:
                root = await conn.fetchrow(WITH_LINKED_COUNT_SQL, linked_to)

    created = serialize.row(row)
    created["linked_count"] = 0

    if linked_to is None:
        # A genuinely new emergency: goes onto volunteer feeds.
        await manager.broadcast(events.GLOBAL, events.NEW_REQUEST, created)
        # PUSH: candidate trigger -- a high-urgency request with no
        # available/connected volunteers nearby is exactly the case a WS
        # broadcast can't help with (nobody's listening). Undecided whether
        # to push here at all, and if so, to whom -- see
        # docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md.
    else:
        # A duplicate of a live emergency. Deliberately NOT a `new_request`:
        # it must not appear as a second card in the volunteer feed. Instead
        # the ROOT is re-broadcast with a bumped linked_count, which drives
        # Dev A's "N others also need this here" indicator.
        root_out = serialize.row(root)
        created["linked_root"] = root_out
        await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, root_out)
        await manager.broadcast(
            events.request_channel(linked_to), events.STATUS_UPDATE, root_out)
        log.info("request %s linked as duplicate of %s", created["id"], linked_to)

    return created


@router.get("/requests")
async def list_requests(status: str | None = None, admin_status: str | None = None,
                        limit: int = 100):
    """Admin queue -- urgency first, then oldest-first within an urgency band."""
    rows = await db.fetch(
        f"""
        select r.*,
               (select count(*) from requests d where d.linked_request_id = r.id)
                 as linked_count
          from requests r
         where ($1::text is null or r.status = $1)
           and ($2::text is null or r.admin_status = $2)
         order by {URGENCY_ORDER_SQL} desc, r.created_at asc
         limit $3
        """,
        status, admin_status, limit,
    )
    return serialize.rows(rows)


# ---------------------------------------------------------------------------
# STEP 5 -- Volunteer feed.
# NOTE: this route MUST stay declared above /requests/{request_id}, or FastAPI
# matches "nearby" as a request id and every feed call 400s.
# ---------------------------------------------------------------------------
@router.get("/requests/nearby")
async def nearby_requests(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_m: float = Query(config.DEFAULT_NEARBY_RADIUS_M, gt=0),
    limit: int = Query(100, gt=0, le=500),
):
    """Open requests near a volunteer, urgency-first.

    Filters, in the order the task spec states them:
      * status = 'requested'      -- not already matched/resolved/expired
      * admin_status != 'rejected'-- pending is fine: PRD says approval runs in
                                     parallel and must never gate a live request
      * within radius_m           -- earth_distance on lat/lng
      * linked_request_id is null -- duplicates are folded into their root and
                                     surfaced as linked_count, not as extra cards

    Sorted urgency desc then newest-first (Step 5's "urgency then recency").
    `distance_m` is returned on every row so the Flutter client can re-sort by
    urgency-then-distance for the feed screen (Step 7) without a second call.
    """
    rows = await db.fetch(
        f"""
        select r.*,
               earth_distance(ll_to_earth(r.lat, r.lng),
                              ll_to_earth($1, $2)) as distance_m,
               (select count(*) from requests d where d.linked_request_id = r.id)
                 as linked_count
          from requests r
         where r.status = 'requested'
           and r.admin_status <> 'rejected'
           and r.linked_request_id is null
           and earth_distance(ll_to_earth(r.lat, r.lng),
                              ll_to_earth($1, $2)) <= $3::float8
         order by {URGENCY_ORDER_SQL} desc, r.created_at desc
         limit $4
        """,
        lat, lng, float(radius_m), limit,
    )
    return serialize.rows(rows)


@router.get("/requests/{request_id}/compatible-donors")
async def compatible_donors(request_id: str, radius_m: float = Query(20000, gt=0)):
    """Requirement-compatible matching for blood requests (docs/AGENT-FLOW.md
    section 6): nearby, available helpers whose blood_type can actually give
    to the blood group this request needs -- not just "nearby volunteers."
    """
    rid = parse_uuid(request_id, "request_id")
    req = await db.fetchrow("select * from requests where id = $1", rid)
    if req is None:
        raise HTTPException(404, "request not found")
    if req["category"] != "blood":
        raise HTTPException(400, "compatible-donors only applies to blood requests")

    needed = (req["service_details"] or {}).get("blood_group")
    if not needed:
        raise HTTPException(
            400, "request has no service_details.blood_group to match against")

    donor_types = sorted(blood.compatible_donor_types(needed))
    rows = await db.fetch(
        """
        select h.*,
               earth_distance(ll_to_earth(h.lat, h.lng), ll_to_earth($1, $2)) as distance_m
          from helpers h
         where h.available = true
           and h.blood_type = any($3::text[])
           and h.lat is not null and h.lng is not null
           and earth_distance(ll_to_earth(h.lat, h.lng), ll_to_earth($1, $2)) <= $4::float8
         order by distance_m asc
        """,
        req["lat"], req["lng"], donor_types, float(radius_m),
    )
    return {
        "needed_blood_group": needed,
        "compatible_donor_types": donor_types,
        "donors": serialize.rows(rows),
    }


@router.get("/requests/{request_id}")
async def get_request(request_id: str):
    rid = parse_uuid(request_id, "request_id")
    row = await db.fetchrow(
        """
        select r.*,
               (select count(*) from requests d where d.linked_request_id = r.id)
                 as linked_count
          from requests r where r.id = $1
        """,
        rid,
    )
    if row is None:
        raise HTTPException(404, "request not found")
    out = serialize.row(row)
    m = await db.fetchrow(
        """
        select m.*, h.name as helper_name, h.role as helper_role,
               h.org_name as helper_org, h.phone as helper_phone
          from matches m join helpers h on h.id = m.helper_id
         where m.request_id = $1
        """,
        rid,
    )
    out["match"] = serialize.row(m)
    return out


# ---------------------------------------------------------------------------
# STEP 2 -- Atomic accept.  First-accept-wins, race-safe.
# ---------------------------------------------------------------------------
ACCEPT_SQL = """
update requests
   set status = 'matched', updated_at = now()
 where id = $1
   and status = 'requested'
   and admin_status <> 'rejected'
returning *
"""


@router.post("/requests/{request_id}/accept")
async def accept_request(request_id: str, body: AcceptBody):
    """Claim a request for a helper.

    Correctness rests on three things, in order:

    1. A single conditional UPDATE (`where status = 'requested'`) does the
       claim. Postgres serialises concurrent writers on the same row, so of N
       simultaneous callers exactly one sees `returning *` produce a row -- the
       rest get zero rows. This is NOT a check-then-write; there is no window.
    2. The UPDATE and the `matches` INSERT run in ONE transaction. If the
       insert fails (bad helper_id, dup) the status flip rolls back, so a
       request can never be left 'matched' with no match row.
    3. `matches_request_id_uniq` makes a second match row impossible at the
       storage layer even if 1 and 2 were both somehow defeated.

    The broadcast happens only after the transaction commits -- we never
    announce a match that got rolled back.
    """
    rid = parse_uuid(request_id, "request_id")

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            claimed = await conn.fetchrow(ACCEPT_SQL, rid)

            if claimed is None:
                # Lost the race (or never eligible). Work out which, for a
                # message the volunteer app can actually show a human.
                existing = await conn.fetchrow(
                    "select status, admin_status from requests where id = $1", rid
                )
                if existing is None:
                    raise HTTPException(404, "request not found")
                if existing["admin_status"] == "rejected":
                    return JSONResponse(
                        status_code=409,
                        content={
                            "code": "rejected",
                            "detail": "This request was rejected by an admin.",
                            "request_id": str(rid),
                            "current_status": existing["status"],
                        },
                    )
                existing_match = await conn.fetchrow(
                    """
                    select m.*, h.name as helper_name
                      from matches m left join helpers h on h.id = m.helper_id
                     where m.request_id = $1
                    """,
                    rid,
                )
                helper_name = existing_match["helper_name"] if existing_match else "another responder"
                msg = f"This emergency request has already been accepted by {helper_name}."
                return JSONResponse(
                    status_code=409,
                    content={
                        "code": "already_matched",
                        "detail": msg,
                        "request_id": str(rid),
                        "current_status": existing["status"],
                    },
                )

            # Resolve or upsert helper
            hid = None
            if body.helper_id:
                try:
                    hid = uuid.UUID(str(body.helper_id))
                    helper = await conn.fetchrow("select * from helpers where id = $1", hid)
                except (ValueError, AttributeError):
                    helper = None
            else:
                helper = None

            if helper is None:
                phone = body.helper_phone or "+91 98201 55019"
                helper = await conn.fetchrow("select * from helpers where phone = $1", phone)
                if helper is None:
                    name = body.helper_name or "Volunteer Unit Alpha (Red Cross Mumbai)"
                    role = body.helper_role or "volunteer"
                    helper = await conn.fetchrow(
                        """
                        insert into helpers (name, phone, role, verified, available, lat, lng, blood_type)
                        values ($1, $2, $3, true, true, $4, $5, $6)
                        returning *
                        """,
                        name, phone, role, body.helper_lat, body.helper_lng, body.blood_group,
                    )
                hid = helper["id"]
            else:
                hid = helper["id"]
                # Update location/blood_type if passed
                if body.helper_lat is not None or body.blood_group is not None:
                    helper = await conn.fetchrow(
                        """
                        update helpers
                           set lat = coalesce($2, lat), lng = coalesce($3, lng),
                               blood_type = coalesce($4, blood_type)
                         where id = $1
                        returning *
                        """,
                        hid, body.helper_lat, body.helper_lng, body.blood_group,
                    )

            match = await conn.fetchrow(
                """
                insert into matches (request_id, helper_id)
                values ($1, $2)
                returning *
                """,
                rid, hid,
            )

            incident_out = None
            if claimed["incident_id"] is not None:
                advanced = await incident_status.advance(
                    conn, claimed["incident_id"], "responder_accepted")
                if advanced is not None:
                    incident_out = serialize.row(advanced)

    req_out = serialize.row(claimed)
    match_out = serialize.row(match)
    helper_out = serialize.row(helper)
    req_out["match_info"] = {
        "id": match_out["id"],
        "helper_name": helper_out.get("name"),
        "helper_phone": helper_out.get("phone"),
        "helper_role": helper_out.get("role"),
        "blood_group": helper_out.get("blood_type"),
        "helper_lat": helper_out.get("lat"),
        "helper_lng": helper_out.get("lng"),
    }
    payload = {
        "status": "matched",
        "request": req_out,
        "match": match_out,
        "helper": {
            "id": helper_out["id"],
            "name": helper_out.get("name"),
            "role": helper_out.get("role"),
            "org_name": helper_out.get("org_name"),
            "phone": helper_out.get("phone"),
            "lat": helper_out.get("lat"),
            "lng": helper_out.get("lng"),
            "blood_type": helper_out.get("blood_type"),
        },
    }

    # The requester's live status view is on the per-request channel.
    await manager.broadcast(events.request_channel(rid), events.MATCHED, payload)
    # Other volunteers' feeds drop the request the moment it's taken.
    await manager.broadcast(events.GLOBAL, events.MATCHED, payload)
    if incident_out is not None:
        await manager.broadcast(
            events.incident_channel(incident_out["id"]), events.INCIDENT_UPDATE, incident_out)
        await manager.broadcast(events.GLOBAL, events.INCIDENT_UPDATE, incident_out)

    log.info("request %s accepted by helper %s (match %s)", rid, hid, match_out["id"])
    return payload


# ---------------------------------------------------------------------------
# Admin approve/reject/flag  +  optional enrichment  (Dev A's surfaces)
# ---------------------------------------------------------------------------
@router.patch("/requests/{request_id}")
async def patch_request(request_id: str, body: RequestAdminPatch):
    rid = parse_uuid(request_id, "request_id")
    if body.admin_status is None and body.status is None:
        raise HTTPException(400, "nothing to update")
    row = await db.fetchrow(
        """
        update requests
           set admin_status = coalesce($2, admin_status),
               status       = coalesce($3, status),
               updated_at   = now()
         where id = $1
        returning *
        """,
        rid, body.admin_status, body.status,
    )
    if row is None:
        raise HTTPException(404, "request not found")
        
    if body.status in ("resolved", "expired") and row["incident_id"] is not None:
        async with db.pool().acquire() as conn:
            await incident_status.maybe_auto_resolve(conn, row["incident_id"])

    out = serialize.row(row)
    await manager.broadcast(events.request_channel(rid), events.STATUS_UPDATE, out)
    await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, out)
    return out


@router.patch("/requests/{request_id}/enrich")
async def enrich_request(request_id: str, body: RequestEnrich):
    """PRD identity step 2 -- non-blocking, skippable detail added after submit."""
    rid = parse_uuid(request_id, "request_id")
    row = await db.fetchrow(
        """
        update requests
           set requester_name  = coalesce($2, requester_name),
               requester_phone = coalesce($3, requester_phone),
               details         = coalesce($4, details),
               photo_url       = coalesce($5, photo_url),
               voice_note_url  = coalesce($6, voice_note_url),
               service_details = coalesce($7, service_details),
               updated_at      = now()
         where id = $1
        returning *
        """,
        rid, body.requester_name, body.requester_phone, body.details, body.photo_url,
        body.voice_note_url, body.service_details,
    )
    if row is None:
        raise HTTPException(404, "request not found")
    out = serialize.row(row)
    await manager.broadcast(events.request_channel(rid), events.STATUS_UPDATE, out)
    return out


# ---------------------------------------------------------------------------
# PRD Flow E -- stale request handling.
#   "Requests with no status update after a set time window are prompted to
#    the requester: 'Still need help?' -- no response after a further window
#    auto-expires the request."
# `keepalive` is what the client calls when the requester answers "yes"; the
# expiry sweep (app/expiry.py) is what happens on silence.
# ---------------------------------------------------------------------------
@router.post("/requests/{request_id}/keepalive")
async def keepalive_request(request_id: str):
    """Requester confirmed they still need help -- resets the staleness clock."""
    rid = parse_uuid(request_id, "request_id")
    row = await db.fetchrow(
        """
        update requests set updated_at = now()
         where id = $1 and status = 'requested'
        returning *
        """,
        rid,
    )
    if row is None:
        existing = await db.fetchrow("select status from requests where id = $1", rid)
        if existing is None:
            raise HTTPException(404, "request not found")
        # Already matched/resolved/expired -- nothing to keep alive, not an error.
        return {"status": existing["status"], "kept_alive": False}
    return {"status": "requested", "kept_alive": True}


# ---------------------------------------------------------------------------
# PRD Flow A -- "Requester can mark resolved, or confirm resolution when
# helper marks it." The helper side is `PATCH /matches/{id}`; this is the
# requester-initiated half, valid whether or not a match exists yet (e.g.
# help arrived some other way, or the requester wants to cancel).
# ---------------------------------------------------------------------------
@router.post("/requests/{request_id}/resolve")
async def resolve_request(request_id: str):
    rid = parse_uuid(request_id, "request_id")

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                update requests set status = 'resolved', updated_at = now()
                 where id = $1 and status not in ('resolved', 'expired')
                returning *
                """,
                rid,
            )
            if row is None:
                existing = await conn.fetchrow(
                    "select * from requests where id = $1", rid)
                if existing is None:
                    raise HTTPException(404, "request not found")
                return serialize.row(existing)  # already resolved/expired -- no-op

            match = await conn.fetchrow(
                """
                update matches set status = 'resolved'
                 where request_id = $1 and status <> 'resolved'
                returning *
                """,
                rid,
            )

            if row["incident_id"] is not None:
                await incident_status.maybe_auto_resolve(conn, row["incident_id"])

    out = serialize.row(row)
    await manager.broadcast(events.request_channel(rid), events.STATUS_UPDATE, out)
    await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, out)
    if match is not None:
        await manager.broadcast(
            events.match_channel(match["id"]), events.STATUS_UPDATE,
            {"match": serialize.row(match), "request": out},
        )
    log.info("request %s resolved by requester", rid)
    return out


@router.post("/requests/{request_id}/reopen")
async def reopen_request(request_id: str, body: RequestReopen):
    rid = parse_uuid(request_id, "request_id")
    async with db.pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                update requests
                   set status = 'requested',
                       updated_at = now()
                 where id = $1
                   and status in ('resolved', 'expired')
                returning *
                """,
                rid,
            )
            if row is None:
                existing = await conn.fetchrow("select * from requests where id = $1", rid)
                if existing is None:
                    raise HTTPException(404, "request not found")
                # If it's already requested, matched, or in_progress, it's not closed.
                return serialize.row(existing)

            # If it was part of an incident and the incident was resolved,
            # this reopen does NOT auto-reopen the incident. The incident is
            # historical. A new SOS would create a new incident. (PRD Flow F)

    out = serialize.row(row)
    out["reopen_reason"] = body.reason
    await manager.broadcast(events.request_channel(rid), events.STATUS_UPDATE, out)
    await manager.broadcast(events.GLOBAL, events.STATUS_UPDATE, out)
    log.info("request %s reopened (reason: %s)", rid, body.reason)
    return out
