import logging
import threading

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database.connection import engine, Base
from .api import health, cranes, commands, telemetry
from .services.firebase_listener import init_firebase

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Initialise Firebase Admin SDK
    try:
        init_firebase()
        # TODO: start telemetry listener threads per crane once cranes are seeded
        # from .services.firebase_listener import start_telemetry_listener
        # threading.Thread(target=start_telemetry_listener, args=("", on_telemetry), daemon=True).start()
    except Exception as e:
        logging.warning("Firebase Admin SDK not initialised: %s", e)

    yield


app = FastAPI(title="Crane IoT API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "ok", "docs": "/docs", "health": "/health"}


app.include_router(health.router)
app.include_router(cranes.router)
app.include_router(commands.router)
app.include_router(telemetry.router)
