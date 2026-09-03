import json
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("crisis_connect.ws")


class ConnectionManager:
    def __init__(self):
        # Map of channel_name -> set of WebSocket connections
        self.active_channels: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel: str):
        await websocket.accept()
        if channel not in self.active_channels:
            self.active_channels[channel] = set()
        self.active_channels[channel].add(websocket)
        logger.info(f"WebSocket connected to channel [{channel}]. Total listeners: {len(self.active_channels[channel])}")

    def disconnect(self, websocket: WebSocket, channel: str):
        if channel in self.active_channels:
            self.active_channels[channel].discard(websocket)
            if not self.active_channels[channel]:
                del self.active_channels[channel]
        logger.info(f"WebSocket disconnected from channel [{channel}]")

    async def broadcast(self, channel: str, event_type: str, data: Any):
        """
        Broadcast an event to all subscribers in a specific channel.
        Events: 'new_request', 'matched', 'status_update', 'new_message', 'zone_confirmed'
        """
        payload = {
            "event": event_type,
            "channel": channel,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        message_str = json.dumps(payload)

        # Broadcast to specific channel
        sockets = list(self.active_channels.get(channel, set()))
        for ws in sockets:
            try:
                await ws.send_text(message_str)
            except Exception as e:
                logger.warning(f"Failed to send to socket in channel [{channel}]: {e}")
                self.disconnect(ws, channel)

        # If it's a critical system event and not already in 'admin', also notify 'admin' channel
        if channel != "admin" and event_type in ("new_request", "status_update", "matched", "zone_confirmed"):
            admin_sockets = list(self.active_channels.get("admin", set()))
            for ws in admin_sockets:
                try:
                    await ws.send_text(message_str)
                except Exception as e:
                    logger.warning(f"Failed to send to admin socket: {e}")
                    self.disconnect(ws, "admin")

    async def broadcast_all(self, event_type: str, data: Any):
        """Broadcast an event across all connected channels"""
        payload = {
            "event": event_type,
            "channel": "global",
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        message_str = json.dumps(payload)
        all_sockets = [ws for s in self.active_channels.values() for ws in s]
        for ws in set(all_sockets):
            try:
                await ws.send_text(message_str)
            except Exception:
                pass


ws_manager = ConnectionManager()
