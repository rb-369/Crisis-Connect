"""Incident endpoints (docs/AGENT-FLOW.md section 2A).

An incident is what groups multiple critical (SOS) requests raised from the
same disaster site -- see app/routers/sos.py for how a request joins one.
This router is the read/update side: list, detail, the responder's on-scene
assessment, and admin coordination tagging.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from .. import db, events, incident_status, serialize
from ..ids import parse_uuid
from ..schemas import IncidentAssessment, IncidentPatch
from ..ws import manager

log = logging.getLogger("crisisconnect.incidents")
router = APIRouter(tags=["incidents"])

# ---------------------------------------------------------------------------
# Escalating responder search (docs/AGENT-FLOW.md section 2A step 3: "default
# ~5km, able to increase radius when insufficient responders"). Hardcoded
# here as a module constant, NOT in app/config.py -- BE-CRITICAL does not own
# that file (contract section 5).
# ---------------------------------------------------------------------------
INCIDENT_SEARCH_RADII_M = [5_000, 10_000, 25_000]  # 5km -> 10km -> 25km ladder
DEFAULT_MIN_RESPONDERS = 3

RESPONDERS_SQL = """
select h.*,
       earth_distance(ll_to_earth(h.lat, h.lng), ll_to_earth($1, $2)) as distance_m
  from helpers h
 where h.role = 'volunteer'
   and h.available = true
   and h.lat is not null and h.lng is not null
   and earth_distance(ll_to_earth(h.lat, h.lng), ll_to_earth($1, $2)) <= $3::float8
 order by distance_m asc
 limit $4
"""


async def escalate_search(center_lat: float, center_lng: float,
                          min_responders: int = DEFAULT_MIN_RESPONDERS,
                          limit: int = 50):
    """Widen the search radius through INCIDENT_SEARCH_RADII_M until at
    least `min_responders` available volunteers are found near
    (center_lat, center_lng), or the ladder is exhausted.

    Returns (radius_m_used, rows). If the minimum is never reached, returns
    the rows from the LAST (widest) radius tried -- callers always get the
    best available list rather than nothing, with the radius that produced
    it so they can be honest about coverage (e.g. "3 responders alerted
    within 25km").
    """
    rows: list = []
    radius_used = INCIDENT_SEARCH_RADII_M[0]
    for radius in INCIDENT_SEARCH_RADII_M:
        rows = await db.fetch(RESPONDERS_SQL, center_lat, center_lng, float(radius), limit)
        radius_used = radius
        if len(rows) >= min_responders:
            break
    return radius_used, rows


@router.get("/incidents")
async def list_incidents(status: str | None = None, limit: int = 100):
    rows = await db.fetch(
        """
        select * from incidents
         where ($1::text is null or status = $1)
         order by priority desc, created_at desc
         limit $2
        """,
        status, limit,
    )
    return serialize.rows(rows)


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    iid = parse_uuid(incident_id, "incident_id")
    row = await db.fetchrow("select * from incidents where id = $1", iid)
    if row is None:
        raise HTTPException(404, "incident not found")
    out = serialize.row(row)
    linked = await db.fetch(
        "select * from requests where incident_id = $1 order by created_at asc", iid)
    out["requests"] = serialize.rows(linked)
    return out


@router.get("/incidents/{incident_id}/responders")
async def incident_responders(
    incident_id: str,
    radius_m: float | None = Query(default=None, gt=0),
    min_responders: int = Query(default=DEFAULT_MIN_RESPONDERS, ge=1),
    limit: int = Query(default=50, gt=0, le=200),
):
    """Nearby available responders for an incident (docs/AGENT-FLOW.md
    section 2A step 3).

    Two modes:
      * `radius_m` given (e.g. `?radius_m=5000`) -- exact lookup at that
        radius, no escalation.
      * `radius_m` omitted -- escalate through INCIDENT_SEARCH_RADII_M
        (5km -> 10km -> 25km) until at least `min_responders` are found.
        `radius_m` in the response is whichever radius actually matched.
    """
    iid = parse_uuid(incident_id, "incident_id")
    incident = await db.fetchrow("select * from incidents where id = $1", iid)
    if incident is None:
        raise HTTPException(404, "incident not found")

    if radius_m is not None:
        rows = await db.fetch(
            RESPONDERS_SQL, incident["center_lat"], incident["center_lng"],
            float(radius_m), limit,
        )
        radius_used = radius_m
    else:
        radius_used, rows = await escalate_search(
            incident["center_lat"], incident["center_lng"], min_responders, limit)

    return {
        "incident_id": str(iid),
        "radius_m": radius_used,
        "min_responders": min_responders,
        "count": len(rows),
        "responders": serialize.rows(rows),
    }


@router.get("/incidents/{incident_id}/timeline")
async def incident_timeline(incident_id: str):
    """Ordered status-history for the requester's live tracker
    (docs/AGENT-FLOW.md section 2B). One row per status the incident has
    passed through, oldest first -- written by incident_status.advance()
    (and once directly by POST /sos for the initial 'sos_triggered' state)
    into the `incident_events` table."""
    iid = parse_uuid(incident_id, "incident_id")
    exists = await db.fetchval("select exists(select 1 from incidents where id = $1)", iid)
    if not exists:
        raise HTTPException(404, "incident not found")
    rows = await db.fetch(
        "select * from incident_events where incident_id = $1 order by created_at asc",
        iid,
    )
    return serialize.rows(rows)


@router.post("/incidents/{incident_id}/assessment")
async def submit_assessment(incident_id: str, body: IncidentAssessment):
    """Responder's on-scene report -- advances the incident to 'assessed'
    and makes the report visible to admin/NGO/authority dashboards (all one
    shared queue in this build; see docs/AGENT-FLOW.md section 2A step 7 for
    why real external coordination is out of scope)."""
    iid = parse_uuid(incident_id, "incident_id")

    assessment = body.model_dump(exclude_none=True)
    assessment["submitted_at"] = datetime.now(timezone.utc).isoformat()

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """
                update incidents set assessment = $2, updated_at = now()
                 where id = $1
                returning *
                """,
                iid, assessment,
            )
            if row is None:
                raise HTTPException(404, "incident not found")
            advanced = await incident_status.advance(conn, iid, "assessed")
            final = advanced if advanced is not None else row

    out = serialize.row(final)
    await manager.broadcast(events.incident_channel(iid), events.INCIDENT_UPDATE, out)
    await manager.broadcast(events.GLOBAL, events.INCIDENT_UPDATE, out)
    log.info("incident %s: assessment submitted by %s", iid, body.submitted_by)
    return out


@router.patch("/incidents/{incident_id}")
async def patch_incident(incident_id: str, body: IncidentPatch):
    """Admin action: manually advance status or tag coordinating orgs
    (docs/AGENT-FLOW.md section 2A step 7 -- informational tracking only,
    not a real integration with any external NGO/authority system)."""
    iid = parse_uuid(incident_id, "incident_id")
    if body.status is None and body.coordinating_orgs is None:
        raise HTTPException(400, "nothing to update")

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            if body.coordinating_orgs is not None:
                await conn.execute(
                    "update incidents set coordinating_orgs = $2, updated_at = now() where id = $1",
                    iid, body.coordinating_orgs,
                )
            row = await conn.fetchrow("select * from incidents where id = $1", iid)
            if row is None:
                raise HTTPException(404, "incident not found")
            if body.status is not None:
                advanced = await incident_status.advance(conn, iid, body.status)
                if advanced is not None:
                    row = advanced

    out = serialize.row(row)
    await manager.broadcast(events.incident_channel(iid), events.INCIDENT_UPDATE, out)
    await manager.broadcast(events.GLOBAL, events.INCIDENT_UPDATE, out)
    return out
