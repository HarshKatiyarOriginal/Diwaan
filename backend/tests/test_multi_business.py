import uuid
import pytest
from httpx import AsyncClient
from backend.models.diwaan import TenantDashboard
from backend.models.widget_data import WidgetValue, WidgetSeriesPoint, LedgerEvent
from sqlalchemy.future import select

pytestmark = pytest.mark.asyncio

async def test_multi_business_lifecycle(async_client: AsyncClient, get_token, db_session):
    token = await get_token(async_client, "multi@example.com", "Multi Tenant")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Fetch current dashboard list (should be empty initially, 
    # but registering might create one if we did, but let's just create them manually)
    res_me = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = uuid.UUID(res_me.json()["tenant_id"])

    # Manually add two businesses
    dash1_id = uuid.uuid4()
    dash2_id = uuid.uuid4()
    
    dash1 = TenantDashboard(id=dash1_id, tenant_id=tenant_id, name="Bakery", archetype_id="shopkeeper", business_summary="", customized_parameters={}, active_widgets=[])
    dash2 = TenantDashboard(id=dash2_id, tenant_id=tenant_id, name="Cafe", archetype_id="shopkeeper", business_summary="", customized_parameters={}, active_widgets=[])
    
    db_session.add_all([dash1, dash2])
    await db_session.commit()

    # 2. List dashboards
    res_list = await async_client.get("/api/dashboards", headers=headers)
    assert res_list.status_code == 200
    dashboards = res_list.json()
    assert len(dashboards) == 2
    names = {d["name"] for d in dashboards}
    assert "Bakery" in names
    assert "Cafe" in names

    # 3. Rename a dashboard
    res_rename = await async_client.post(f"/api/dashboards/{dash1_id}/rename", json={"name": "Super Bakery"}, headers=headers)
    assert res_rename.status_code == 200
    assert res_rename.json()["name"] == "Super Bakery"

    # 4. Delete a dashboard
    res_delete = await async_client.delete(f"/api/dashboards/{dash2_id}", headers=headers)
    assert res_delete.status_code == 200

    # 5. Verify only one remains
    res_list_after = await async_client.get("/api/dashboards", headers=headers)
    assert len(res_list_after.json()) == 1
    assert res_list_after.json()[0]["name"] == "Super Bakery"


async def test_data_isolated_between_businesses(async_client: AsyncClient, get_token, db_session):
    """Two businesses under the same tenant must not see each other's widget data."""
    token = await get_token(async_client, "twobiz@example.com", "Two Biz Tenant")
    headers = {"Authorization": f"Bearer {token}"}

    res_me = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = uuid.UUID(res_me.json()["tenant_id"])

    dash_a_id, dash_b_id = uuid.uuid4(), uuid.uuid4()
    common_binding = {"binding_catalog": [{"key": "monthly_revenue", "kind": "metric"}]}
    dash_a = TenantDashboard(id=dash_a_id, tenant_id=tenant_id, name="Shop A", archetype_id="shopkeeper",
                              business_summary="", customized_parameters=common_binding, active_widgets=[])
    dash_b = TenantDashboard(id=dash_b_id, tenant_id=tenant_id, name="Shop B", archetype_id="shopkeeper",
                              business_summary="", customized_parameters=common_binding, active_widgets=[])
    db_session.add_all([dash_a, dash_b])
    await db_session.commit()

    res_put = await async_client.put(
        f"/api/dashboards/{dash_a_id}/data/monthly_revenue", headers=headers, json={"value": 999}
    )
    assert res_put.status_code == 200

    res_get_a = await async_client.get(f"/api/dashboards/{dash_a_id}/data", headers=headers)
    assert res_get_a.json()["data"]["monthly_revenue"]["value_json"]["value"] == 999

    res_get_b = await async_client.get(f"/api/dashboards/{dash_b_id}/data", headers=headers)
    assert "monthly_revenue" not in res_get_b.json()["data"]


async def test_delete_dashboard_removes_its_data(async_client: AsyncClient, get_token, db_session):
    """DELETE must actually remove the dashboard's widget rows, not just the dashboard row."""
    token = await get_token(async_client, "deleteme@example.com", "Delete Tenant")
    headers = {"Authorization": f"Bearer {token}"}

    res_me = await async_client.get("/api/auth/me", headers=headers)
    tenant_id = uuid.UUID(res_me.json()["tenant_id"])

    dash_id = uuid.uuid4()
    dash = TenantDashboard(
        id=dash_id, tenant_id=tenant_id, name="Doomed Shop", archetype_id="shopkeeper",
        business_summary="", customized_parameters={"binding_catalog": [{"key": "rev", "kind": "metric"}]},
        active_widgets=[],
    )
    db_session.add(dash)
    await db_session.commit()

    res_put = await async_client.put(f"/api/dashboards/{dash_id}/data/rev", headers=headers, json={"value": 42})
    assert res_put.status_code == 200
    res_action = await async_client.post(
        f"/api/dashboards/{dash_id}/actions/do_thing", headers=headers, json={"label": "x"}
    )
    assert res_action.status_code == 200

    res_delete = await async_client.delete(f"/api/dashboards/{dash_id}", headers=headers)
    assert res_delete.status_code == 200

    for model in (WidgetValue, WidgetSeriesPoint, LedgerEvent):
        result = await db_session.execute(select(model).where(model.dashboard_id == dash_id))
        assert result.scalars().all() == [], f"{model.__name__} rows survived the dashboard delete"
