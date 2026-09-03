import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from config import PORT, HOST, USE_LIVE_SUPABASE
from database import mem_db
from websocket_manager import ws_manager
from routers.requests import router as requests_router
from routers.messages import router as messages_router
from routers.zones import router as zones_router
from routers.auth import router as auth_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("crisis_connect")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"CrisisConnect Backend starting. Supabase Live Mode: {USE_LIVE_SUPABASE}")
    yield
    logger.info("CrisisConnect Backend stopping.")


app = FastAPI(
    title="CrisisConnect Backend API",
    description="Emergency coordination platform API with native WebSockets & Supabase Postgres.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware to allow React Vite frontend and mobile emulators
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(requests_router)
app.include_router(messages_router)
app.include_router(zones_router)
app.include_router(auth_router)



# Root & Health check
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "CrisisConnect API",
        "version": "1.0.0",
        "supabase_connected": USE_LIVE_SUPABASE,
        "websocket_endpoint": "/ws/{channel_type}/{channel_id}",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_ws_channels": list(ws_manager.active_channels.keys()),
        "total_requests": len(mem_db.requests),
        "total_zones": len(mem_db.confirmed_zones),
    }


@app.post("/seed")
async def reseed():
    """Resets and reseeds demo crisis data"""
    mem_db.requests.clear()
    mem_db.matches.clear()
    mem_db.messages.clear()
    mem_db.zone_reports.clear()
    mem_db.confirmed_zones.clear()
    mem_db.seed_default_data()
    await ws_manager.broadcast_all("reseeded", {"status": "ok"})
    return {"message": "Demo data reseeded successfully."}


# Native WebSocket Endpoint
@app.websocket("/ws/{channel_type}/{channel_id}")
async def websocket_endpoint(websocket: WebSocket, channel_type: str, channel_id: str):
    """
    Native WebSocket connection endpoint.
    Channels:
    - /ws/request/{request_id} : live updates for a specific request
    - /ws/match/{match_id}     : chat and status updates for a match
    - /ws/admin/{any}          : admin notifications, new requests, triage changes
    - /ws/zones/{any}          : crisis zone confirmations
    """
    channel_name = f"{channel_type}:{channel_id}" if channel_type not in ("admin", "zones", "volunteers") else channel_type
    await ws_manager.connect(websocket, channel_name)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "event": "connected",
            "channel": channel_name,
            "message": f"Subscribed to {channel_name}",
        })
        while True:
            # Keep connection open and accept incoming client pings or messages
            client_msg = await websocket.receive_text()
            # If client sends a ping or message, acknowledge it
            try:
                await websocket.send_json({
                    "event": "ack",
                    "echo": client_msg,
                })
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, channel_name)
    except Exception as e:
        logger.error(f"WebSocket error in {channel_name}: {e}")
        ws_manager.disconnect(websocket, channel_name)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
