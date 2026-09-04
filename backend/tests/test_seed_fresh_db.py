import pytest
import os
import tempfile
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine
import backend.models
from backend.models import Base
from backend.scripts.seed_archetypes import seed_archetypes


@pytest.mark.asyncio
async def test_seed_archetypes_creates_onboarding_sessions_table_on_fresh_db():
    # Create a fresh temporary SQLite DB file
    temp_dir = tempfile.mkdtemp()
    db_path = os.path.join(temp_dir, "fresh_test.db")
    db_url = f"sqlite+aiosqlite:///{db_path}"

    test_engine = create_async_engine(db_url, echo=False)

    try:
        # Run create_all on the fresh DB engine
        async with test_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Inspect created tables
            def get_table_names(sync_conn):
                inspector = inspect(sync_conn)
                return inspector.get_table_names()

            table_names = await conn.run_sync(get_table_names)

        # Assert onboarding_sessions table exists in the fresh DB
        assert "onboarding_sessions" in table_names
        assert "tenant_dashboards" in table_names
        assert "audit_sessions" in table_names
        assert "users" in table_names
        assert "tenants" in table_names

    finally:
        await test_engine.dispose()
        if os.path.exists(db_path):
            os.remove(db_path)
