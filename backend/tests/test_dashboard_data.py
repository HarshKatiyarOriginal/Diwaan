import uuid
import pytest
from httpx import AsyncClient
from backend.models.diwaan import TenantDashboard
from backend.models.onboarding import OnboardingSession
from backend.models.widget_data import WidgetValue, WidgetSeriesPoint, LedgerEvent
from sqlalchemy.future import select

pytestmark = pytest.mark.asyncio

async def test_set_metric_twice(async_client: AsyncClient, get_token, db_session):
    token = await get_token(async_client, "owner@example.com", "Test Tenant")
    headers = {"Authorization": f"Bearer {token}"}
    
    # We need a dashboard with a binding catalog first
    dash = TenantDashboard(
        tenant_id="00000000-0000-0000-0000-000000000000", # Will be overridden
        archetype_id="shopkeeper",
        business_summary="A shop",
        customized_parameters={
            "binding_catalog": [{"key": "daily_rev", "kind": "metric"}]
        },
        active_widgets=[]
    )
    # Actually, we need the real tenant_id
    res = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = res.json()["tenant_id"]
    dash.tenant_id = uuid.UUID(tenant_id)
    db_session.add(dash)
    await db_session.commit()

    # PUT first value
    res1 = await async_client.put(
        f"/api/dashboards/{tenant_id}/data/daily_rev",
        headers=headers,
        json={"value": 150.5}
    )
    assert res1.status_code == 200

    # PUT second value
    res2 = await async_client.put(
        f"/api/dashboards/{tenant_id}/data/daily_rev",
        headers=headers,
        json={"value": 200.0}
    )
    assert res2.status_code == 200

    # Check GET data
    res_get = await async_client.get(f"/api/dashboards/{tenant_id}/data", headers=headers)
    assert res_get.status_code == 200
    data = res_get.json()["data"]
    assert "daily_rev" in data
    assert data["daily_rev"]["value_json"]["value"] == 200.0
    # last_two should have 200.0 and 150.5
    assert data["daily_rev"]["last_two"] == [200.0, 150.5]


async def test_cross_tenant_rejection(async_client: AsyncClient, get_token):
    token1 = await get_token(async_client, "t1@example.com", "T1")
    headers1 = {"Authorization": f"Bearer {token1}"}
    
    token2 = await get_token(async_client, "t2@example.com", "T2")
    headers2 = {"Authorization": f"Bearer {token2}"}
    
    res1 = await async_client.get("/api/auth/me", headers=headers1)
    tenant1_id = res1.json()["tenant_id"]

    # Try to access tenant1's data with tenant2's token
    res = await async_client.get(f"/api/dashboards/{tenant1_id}/data", headers=headers2)
    assert res.status_code == 403
    assert "denied" in res.json()["error"].lower()


async def test_binding_violation(async_client: AsyncClient, get_token, db_session):
    token = await get_token(async_client, "owner3@example.com", "Test Tenant 3")
    headers = {"Authorization": f"Bearer {token}"}
    
    res = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = res.json()["tenant_id"]

    dash = TenantDashboard(
        tenant_id=uuid.UUID(tenant_id),
        archetype_id="shopkeeper",
        business_summary="A shop",
        customized_parameters={
            "binding_catalog": [{"key": "valid_key", "kind": "metric"}]
        },
        active_widgets=[]
    )
    db_session.add(dash)
    await db_session.commit()

    # PUT invalid key
    res_put = await async_client.put(
        f"/api/dashboards/{tenant_id}/data/invalid_key",
        headers=headers,
        json={"value": 10}
    )
    assert res_put.status_code == 422
    assert "not in this dashboard" in res_put.json()["error"].lower()


async def test_ledger_event_fires(async_client: AsyncClient, get_token, db_session):
    token = await get_token(async_client, "owner4@example.com", "Test Tenant 4")
    headers = {"Authorization": f"Bearer {token}"}
    
    res = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = res.json()["tenant_id"]

    res_post = await async_client.post(
        f"/api/dashboards/{tenant_id}/actions/my_action",
        headers=headers,
        json={"label": "Did a thing"}
    )
    assert res_post.status_code == 200
    ev = res_post.json()
    assert ev["label"] == "Did a thing"
    assert ev["key"] == "my_action"

    res_get = await async_client.get(f"/api/dashboards/{tenant_id}/actions/my_action", headers=headers)
    assert res_get.status_code == 200
    evs = res_get.json()
    assert len(evs) == 1
    assert evs[0]["label"] == "Did a thing"
