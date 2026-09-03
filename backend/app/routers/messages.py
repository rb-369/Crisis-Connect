"""In-app chat between a matched requester and volunteer."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from .. import db, events, serialize
from ..ids import parse_uuid
from ..schemas import MessageCreate
from ..ws import manager

router = APIRouter(tags=["messages"])


@router.post("/messages", status_code=201)
async def create_message(body: MessageCreate):
    mid = parse_uuid(body.match_id, "match_id")
    # Checked explicitly so a bad match_id is a 404, not an FK 500.
    if not await db.fetchval("select exists(select 1 from matches where id = $1)", mid):
        raise HTTPException(404, "match not found")

    row = await db.fetchrow(
        """
        insert into messages (match_id, sender_id, body)
        values ($1,$2,$3)
        returning *
        """,
        mid, body.sender_id.strip(), body.body,
    )
    out = serialize.row(row)
    await manager.broadcast(events.match_channel(mid), events.NEW_MESSAGE, out)
    # PUSH: candidate trigger -- notify the OTHER party in the match if
    # they're backgrounded. Needs the manager to know who's connected right
    # now vs. not, which it doesn't track yet -- see
    # docs/NOTIFICATIONS-HAPTICS-SHORTCUTS.md.
    return out


@router.get("/messages/{match_id}")
async def list_messages(match_id: str, limit: int = Query(500, gt=0, le=2000)):
    """Chat history, oldest first -- what a chat screen renders top to bottom."""
    mid = parse_uuid(match_id, "match_id")
    rows = await db.fetch(
        "select * from messages where match_id = $1 order by sent_at asc limit $2",
        mid, limit)
    return serialize.rows(rows)
