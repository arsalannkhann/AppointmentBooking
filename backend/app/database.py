"""
database.py — Async SQLAlchemy with Cloud SQL PostgreSQL

Cloud SQL connection modes:
  1. Cloud SQL Auth Proxy (Unix socket) — recommended for Cloud Run
  2. Cloud SQL Auth Proxy (TCP)         — local dev with proxy
  3. Direct TCP (Private IP / VPC)      — for internal GKE use
  4. SQLite                              — local dev without proxy

Environment variables:
  DB_DRIVER            : postgresql+asyncpg | sqlite+aiosqlite  (default: postgresql+asyncpg)
  CLOUD_SQL_CONNECTION_NAME : project:region:instance            (e.g. my-proj:us-central1:meddent-db)
  DB_NAME              : database name            (default: bronn)
  DB_USER              : database user            (default: meddent_app)
  DB_PASSWORD          : database password
  DB_HOST              : TCP host override        (default: 127.0.0.1)
  DB_PORT              : TCP port                 (default: 5432)
  USE_UNIX_SOCKET      : "true" to use Cloud SQL Unix socket (auto on Cloud Run)
"""

import os
import urllib.parse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# ── Build connection URL ───────────────────────────────────────

DRIVER      = os.getenv("DB_DRIVER", "postgresql+asyncpg")
DB_NAME     = os.getenv("DB_NAME",   "bronn")
DB_USER     = os.getenv("DB_USER",   "meddent_app")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
ENCODED_PASSWORD = urllib.parse.quote_plus(DB_PASSWORD) if DB_PASSWORD else ""
DB_HOST     = os.getenv("DB_HOST",   "127.0.0.1")
DB_PORT     = os.getenv("DB_PORT",   "5432")
INSTANCE    = os.getenv("CLOUD_SQL_CONNECTION_NAME", "")  # project:region:instance
USE_SOCKET  = os.getenv("USE_UNIX_SOCKET", "false").lower() == "true"

if DRIVER.startswith("sqlite"):
    # SQLite for pure local dev (no Postgres needed)
    DATABASE_URL = f"sqlite+aiosqlite:///./meddent.db"
    engine = create_async_engine(DATABASE_URL, echo=False)
elif USE_SOCKET and INSTANCE:
    # Cloud SQL Auth Proxy via Unix domain socket (Cloud Run default)
    SOCKET_DIR = os.getenv("CLOUD_SQL_SOCKET_DIR", "/cloudsql")
    socket_path = f"{SOCKET_DIR}/{INSTANCE}"
    DATABASE_URL = (
        f"postgresql+asyncpg://{DB_USER}:{ENCODED_PASSWORD}@/{DB_NAME}"
        f"?host={socket_path}"
    )
    engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=2, echo=False)
else:
    # TCP (local proxy or private IP)
    DATABASE_URL = (
        f"postgresql+asyncpg://{DB_USER}:{ENCODED_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=2, echo=False)


AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)


class Base(DeclarativeBase):
    pass


# ── Dependency for FastAPI routes ─────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
