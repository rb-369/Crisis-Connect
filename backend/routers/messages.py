from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db_create_message, db_list_messages
from websocket_manager import ws_manager

router = APIRouter(prefix="/messages", tags=["Messages"])


class MessageCreate(BaseModel):
    match_id: str
    sender_id: str
    body: str


@router.post("", status_code=201)
async def send_message(payload: MessageCreate):
    """
    Step 1 & 7: Send a chat message.
    Broadcasts 'new_message' event to the match WebSocket channel.
    """
    data = payload.model_dump()
    created = await db_create_message(data)

    # Broadcast to match channel
    await ws_manager.broadcast(f"match:{created['match_id']}", "new_message", created)

    return created


@router.get("/{match_id}")
async def get_messages(match_id: str):
    """
    Step 1 & 7: Fetch message history for a match.
    """
    messages = await db_list_messages(match_id)
    return messages
