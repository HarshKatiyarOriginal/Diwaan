import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("TEST_DATABASE_URL", "sqlite+aiosqlite:///./test.db")

from backend.main import app
from backend.db.session import Base, get_db
from backend.core.config import settings

from sqlalchemy.pool import StaticPool

if "sqlite" in settings.TEST_DATABASE_URL:
    test_engine = create_async_engine(
        settings.TEST_DATABASE_URL,
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False}
    )
else:
    test_engine = create_async_engine(settings.TEST_DATABASE_URL, echo=False)

TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=test_engine)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

import pytest_asyncio

from backend.models.diwaan import Archetype
from backend.scripts.seed_archetypes import farmer_base, shopkeeper_base, factory_base

@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        archs = [
            Archetype(id="farmer", base_template=farmer_base),
            Archetype(id="shopkeeper", base_template=shopkeeper_base),
            Archetype(id="factory_owner", base_template=factory_base)
        ]
        session.add_all(archs)
        await session.commit()

    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

import uuid

@pytest_asyncio.fixture
async def db_session():
    async with TestingSessionLocal() as session:
        yield session

@pytest_asyncio.fixture
async def test_user(async_client):
    email = f"test_{uuid.uuid4()}@example.com"
    await async_client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "tenant_name": "Test Tenant"
    })
    res = await async_client.post("/api/auth/login", data={"username": email, "password": "password123"})
    token = res.json()["access_token"]
    return {"email": email, "access_token": token}
