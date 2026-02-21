"""
main.py — MedDent FastAPI Backend
Runs on Cloud Run, connects to Cloud SQL PostgreSQL via Unix socket or TCP.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import appointments, chat, data, slots
from app.seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Seed demo data if the DB is empty
    await seed_if_empty()
    yield


app = FastAPI(
    title="MedDent Booking API",
    version="2.0.0",
    description="AI-powered dental appointment booking system",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(data.router,         prefix="/api/data",         tags=["Static Data"])
app.include_router(appointments.router, prefix="/api/appointments",  tags=["Appointments"])
app.include_router(slots.router,        prefix="/api/slots",         tags=["Slot Finder"])
app.include_router(chat.router,         prefix="/api/chat",          tags=["AI Chat"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "meddent-api", "version": "2.0.0"}
