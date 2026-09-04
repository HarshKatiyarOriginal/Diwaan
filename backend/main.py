from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .models.specshield import AuditSession, Document, ComparisonResult
from .models.diwaan import Archetype, TenantDashboard
from .models.onboarding import OnboardingSession
from backend.models import Base
from backend.api import auth, diwaan, specshield, tasks, onboarding
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

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up backend application")
