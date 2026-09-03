"""Crowd-sourced crisis zone confirmation (PRD verification Layer 2).

Threshold: >= ZONE_THRESHOLD reports of the SAME category, within
ZONE_RADIUS_M metres and ZONE_WINDOW_MIN minutes of each other.
Defaults are the PRD's: 3 reports / 500 m / 30 min.

Note: zone categories (flood/fire/accident/...) are a different vocabulary
from request categories (blood/oxygen/...). A confirmed zone therefore
badges nearby requests by LOCATION only, never by matching category.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from .. import config, db, events, serialize
from ..sachet_alerts import MUMBAI_SACHET_ALERTS
from ..schemas import ZoneReportCreate
from ..ws import manager

log = logging.getLogger("crisisconnect.zones")
router = APIRouter(tags=["zones"])

# Count reports clustered around the new one. The new report is included in
# the count, so ZONE_THRESHOLD=3 means "the 3rd report confirms the zone".
CLUSTER_SQL = """
select count(*)::int              as n,
       avg(lat)::float8           as center_lat,
       avg(lng)::float8           as center_lng
  from zone_reports
 where category = $1
   and reported_at >= now() - ($2::int * interval '1 minute')
   and earth_distance(ll_to_earth(lat, lng), ll_to_earth($3, $4)) <= $5::float8
"""

# Suppress a duplicate zone for a cluster that is already confirmed.
EXISTING_ZONE_SQL = """
select * from confirmed_zones
 where category = $1
   and confirmed_at >= now() - ($2::int * interval '1 minute')
   and earth_distance(ll_to_earth(center_lat, center_lng),
                      ll_to_earth($3, $4)) <= $5::float8
 order by confirmed_at desc
 limit 1
"""


@router.post("/zone-reports", status_code=201)
async def create_zone_report(body: ZoneReportCreate):
    """Drop a pin. Confirms a zone if this report tips the cluster over threshold.

    The whole read-modify-write runs in ONE transaction behind a per-category
    advisory lock. Without that lock, two simultaneous 3rd-reports would both
    see count >= threshold and both insert a zone -- the same class of race as
    the accept endpoint, and just as capable of breaking the demo.
    """
    category = body.category.strip().lower()

    async with db.pool().acquire() as conn:
        async with conn.transaction():
            # Serialise zone confirmation per category. Cheap: zone reports
            # are low-volume, and the lock is released at commit.
            await conn.execute("select pg_advisory_xact_lock(hashtext($1))", category)

            report = await conn.fetchrow(
                """
                insert into zone_reports (category, lat, lng, device_id)
                values ($1,$2,$3,$4)
                returning *
                """,
                category, body.lat, body.lng, body.device_id,
            )

            cluster = await conn.fetchrow(
                CLUSTER_SQL, category, config.ZONE_WINDOW_MIN,
                body.lat, body.lng, float(config.ZONE_RADIUS_M),
            )
            count = cluster["n"]
            center_lat = cluster["center_lat"]
            center_lng = cluster["center_lng"]

            zone = None
            suppressed_by = None
            if count >= config.ZONE_THRESHOLD:
                existing = await conn.fetchrow(
                    EXISTING_ZONE_SQL, category, config.ZONE_DEDUPE_WINDOW_MIN,
                    center_lat, center_lng, float(config.ZONE_DEDUPE_RADIUS_M),
                )
                if existing is not None:
                    suppressed_by = existing
                else:
                    zone = await conn.fetchrow(
                        """
                        insert into confirmed_zones (category, center_lat, center_lng)
                        values ($1,$2,$3)
                        returning *
                        """,
                        category, center_lat, center_lng,
                    )

            # PRD: requests originating inside a Confirmed Zone are badged
            # "likely genuine". Matched on location only (see module docstring).
            badged = []
            if zone is not None:
                badged = await conn.fetch(
                    """
                    update requests
                       set zone_confirmed = true, updated_at = now()
                     where status not in ('resolved', 'expired')
                       and zone_confirmed is not true
                       and earth_distance(ll_to_earth(lat, lng),
                                          ll_to_earth($1, $2)) <= $3::float8
                    returning *
                    """,
                    center_lat, center_lng, float(config.ZONE_RADIUS_M),
                )

    report_out = serialize.row(report)
    zone_out = serialize.row(zone)
    badged_out = serialize.rows(badged) if zone is not None else []

    result = {
        "report": report_out,
        "cluster_count": count,
        "threshold": config.ZONE_THRESHOLD,
        "radius_m": config.ZONE_RADIUS_M,
        "window_min": config.ZONE_WINDOW_MIN,
        "confirmed_zone": zone_out,
        "already_confirmed_zone_id": (
            str(suppressed_by["id"]) if suppressed_by is not None else None
        ),
        "requests_badged": [r["id"] for r in badged_out],
    }

    if zone_out is not None:
        await manager.broadcast(events.GLOBAL, events.ZONE_CONFIRMED, {
            "zone": zone_out,
            "cluster_count": count,
            "requests_badged": result["requests_badged"],
        })
        # Each badged request's own live view learns it's been verified.
        for r in badged_out:
            await manager.broadcast(
                events.request_channel(r["id"]), events.STATUS_UPDATE, r)
        log.info("zone confirmed: %s @ (%.5f, %.5f) from %d reports",
                 category, center_lat, center_lng, count)

    return result


@router.get("/zone-reports")
async def list_zone_reports(limit: int = 200):
    rows = await db.fetch(
        "select * from zone_reports order by reported_at desc limit $1", limit)
    return serialize.rows(rows)


@router.get("/zone-reports/sachet-alerts")
@router.get("/sachet-alerts")
async def sachet_alerts():
    """NDMA-Sachet-style hazard polygon overlay for the admin GIS map.

    Static demo data (Mumbai) -- Layer 3 (ML/news corroboration) is a separate
    bolt-on track per the PRD; this is presentational overlay only, not a live
    feed and not wired into zone-confirmation logic.
    """
    return MUMBAI_SACHET_ALERTS


@router.get("/confirmed-zones")
async def list_confirmed_zones(limit: int = 200):
    """Admin map overlay (Dev A). Includes the live report count per zone."""
    rows = await db.fetch(
        """
        select z.*,
               (select count(*) from zone_reports zr
                 where zr.category = z.category
                   and earth_distance(ll_to_earth(zr.lat, zr.lng),
                                      ll_to_earth(z.center_lat, z.center_lng))
                       <= $2::float8) as report_count
          from confirmed_zones z
         order by z.confirmed_at desc
         limit $1
        """,
        limit, float(config.ZONE_RADIUS_M),
    )
    return serialize.rows(rows)
