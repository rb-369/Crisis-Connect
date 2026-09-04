"""The critical-emergency path (docs/AGENT-FLOW.md section 2).

Deliberately separate from POST /requests: minimum interaction, no
structured fields, no verification gate -- a person mid-disaster does not
fill out a form. This endpoint does three things and nothing else:
  1. Insert the request (severity_class='critical', urgency always 'high').
  2. Group it into an incident with any other recent SOS from the same spot
     (same race-safety pattern as duplicate detection: advisory lock, so two
     simultaneous SOS calls from one collapsed building don't each start
     their own incident).
  3. Broadcast it, and advance the incident to 'alert_sent'.

112-calling and offline-queue-then-sync are client-side concerns (the app
must not depend on this endpoint being reachable to dial emergency
services) -- see volunteer_app/lib or the requester frontend for that half.
This endpoint's `client_created_at`/`via_offline_sync` fields exist so a
request queued offline and synced later still carries its true trigger time.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter

from .. import config, db, events, incident_status, serialize
from ..schemas import SosCreate
from ..ws import manager
from .incidents import escalate_search
from .requests import FAR_FROM_ALL_ZONES_SQL, IN_ZONE_SQL

log = logging.getLogger("crisisconnect.sos")
router = APIRouter(tags=["sos"])

FIND_INCIDENT_SQL = """
select id from incidents
 where category = $1
   and status <> 'resolved'
   and created_at >= now() - ($2::int * interval '1 minute')
   and earth_distance(ll_to_earth(center_lat, center_lng), ll_to_earth($3, $4)) <= $5::float8
 order by created_at asc
 limit 1
"""


@router.post("/sos", status_code=201)
async def create_sos(body: SosCreate):
    async with db.pool().acquire() as conn:
        async with conn.transaction():
            # Serialise per category, same race class and same fix as the
            # duplicate-detection lock in requests.py: two SOS calls at the
            # same site landing in the same instant must join ONE incident,
            # not each conclude "no incident yet" and create two.
            await conn.execute(
                "select pg_advisory_xact_lock(hashtext($1))", f"sos:{body.category}")

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

            incident = None
            try:
                existing_incident_id = await conn.fetchval(
                    FIND_INCIDENT_SQL, body.category, config.INCIDENT_WINDOW_MIN,
                    body.lat, body.lng, float(config.INCIDENT_RADIUS_M),
                )
                if existing_incident_id is not None:
                    incident = await conn.fetchrow(
                        """
                        update incidents
                           set priority = priority + 1, request_count = request_count + 1,
                               updated_at = now()
                         where id = $1
                        returning *
                        """,
                        existing_incident_id,
                    )
                else:
                    incident = await conn.fetchrow(
                        """
                        insert into incidents (category, center_lat, center_lng)
                        values ($1, $2, $3)
                        returning *
                        """,
                        body.category, body.lat, body.lng,
                    )
                    await incident_status.record_event(conn, incident["id"], "sos_triggered")
            except Exception as inc_err:
                log.warning("Incident clustering fallback: %s", inc_err)

            incident_id = incident["id"] if incident is not None else None

            row = await conn.fetchrow(
                """
                insert into requests (category, urgency, lat, lng, requester_device_id,
                                      details, photo_url, admin_status, zone_confirmed,
                                      severity_class, incident_id,
                                      offline_created_at)
                values ($1,'high',$2,$3,$4,$5,$6,$7,$8,'critical',$9,$10)
                returning *
                """,
                body.category, body.lat, body.lng, body.requester_device_id,
                body.details, body.photo_url, admin_status, bool(in_zone),
                incident_id, body.client_created_at,
            )

            advanced = None
            if incident is not None:
                try:
                    advanced = await incident_status.advance(conn, incident["id"], "alert_sent")
                except Exception as adv_err:
                    log.warning("Incident advance warning: %s", adv_err)
            incident_out = advanced if advanced is not None else incident

    created = serialize.row(row)
    created["linked_count"] = 0
    incident_payload = serialize.row(incident_out) if incident_out is not None else {}

    if incident_out is not None:
        try:
            radius_used, responder_rows = await escalate_search(
                incident_out["center_lat"], incident_out["center_lng"])
            incident_payload["responders_notified"] = len(responder_rows)
            incident_payload["responders_search_radius_m"] = radius_used
        except Exception as esc_err:
            log.warning("Escalate responder search warning: %s", esc_err)

    await manager.broadcast(events.GLOBAL, events.NEW_REQUEST, created)
    if incident_out is not None:
        await manager.broadcast(
            events.incident_channel(incident_out["id"]), events.INCIDENT_UPDATE, incident_payload)
        await manager.broadcast(events.GLOBAL, events.INCIDENT_UPDATE, incident_payload)

    log.info(
        "SOS: %s request %s -> incident %s (priority %d, %d linked request(s))%s",
        body.category, created["id"], incident_out["id"], incident_out["priority"],
        incident_out["request_count"], " [offline sync]" if body.via_offline_sync else "",
    )
    return {"request": created, "incident": incident_payload}
