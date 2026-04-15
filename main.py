from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from ws_manager import ws_manager
from session_manager import session_manager
from routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    # Inject ws_manager into session_manager to avoid circular imports
    session_manager.ws_manager = ws_manager
    yield
    # Shutdown (nothing specific needed)


app = FastAPI(
    title="SeatSense — Library Seat Monitoring API",
    description="IoT-based real-time library seat monitoring system.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes
app.include_router(router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "SeatSense API"}


@app.websocket("/ws/seats")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep the connection alive; we only push from the server
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
