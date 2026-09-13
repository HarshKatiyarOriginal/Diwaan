from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models.specshield import AuditSession, Document, ComparisonResult
from .models.diwaan import Archetype, TenantDashboard
from .models.onboarding import OnboardingSession
from backend.models import Base
from backend.db.session import engine
from backend.api import auth, diwaan, specshield, tasks, onboarding, dashboard_data
from backend.core.config import settings
from backend.core.exceptions import APIError, api_error_handler, global_exception_handler
from backend.core.logging import logger

app = FastAPI(title=settings.PROJECT_NAME)

# CORS configuration
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(APIError, api_error_handler)
app.add_exception_handler(Exception, global_exception_handler)

# Routers
app.include_router(auth.router)
app.include_router(diwaan.router)
app.include_router(specshield.router)
app.include_router(tasks.router)
app.include_router(onboarding.router)
app.include_router(dashboard_data.router)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up backend application")
    # Run alembic upgrade head. Resolve paths from this file's location
    # (not CWD) — uvicorn may be launched from the repo root or from
    # backend/, and alembic.ini's `script_location = alembic` is itself
    # resolved relative to CWD, not to the ini file's own directory.
    def run_migrations():
        import os
        from alembic.config import Config
        from alembic import command
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        alembic_cfg = Config(os.path.join(backend_dir, "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
        command.upgrade(alembic_cfg, "head")

    import asyncio
    await asyncio.to_thread(run_migrations)
    logger.info("Alembic migrations applied")

    # Stopgap until Alembic migration versions exist: create any missing
    # tables so a fresh database (SQLite dev, or a new Postgres) is usable.
    # NOTE: create_all does NOT ALTER existing tables — a real migration is
    # still required to add columns to an already-provisioned database.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Schema ensured (create_all)")
