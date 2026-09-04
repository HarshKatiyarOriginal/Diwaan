import pytest
from httpx import AsyncClient
from backend.tests.test_diwaan import get_token

@pytest.mark.asyncio
async def test_specshield_history_list_and_delete(async_client: AsyncClient):
    token_a = await get_token(async_client, "history_a@example.com", "Tenant Hist A")
    
    # Create two sessions for User A
    res_s1 = await async_client.post("/api/specshield/sessions",
        json={"project_name": "Project Alpha"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_s1.status_code == 200
    s1_id = res_s1.json()["id"]

    res_s2 = await async_client.post("/api/specshield/sessions",
        json={"project_name": "Project Beta"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_s2.status_code == 200
    s2_id = res_s2.json()["id"]

    # List sessions for User A
    res_list = await async_client.get("/api/specshield/sessions",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_list.status_code == 200
    sessions = res_list.json()
    assert len(sessions) >= 2
    session_ids = [s["id"] for s in sessions]
    assert s1_id in session_ids
    assert s2_id in session_ids

    # Tenant B isolation check
    token_b = await get_token(async_client, "history_b@example.com", "Tenant Hist B")
    res_list_b = await async_client.get("/api/specshield/sessions",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_list_b.status_code == 200
    b_session_ids = [s["id"] for s in res_list_b.json()]
    assert s1_id not in b_session_ids
    assert s2_id not in b_session_ids

    # User B attempts to delete User A's session -> 404
    res_del_unauth = await async_client.delete(f"/api/specshield/sessions/{s1_id}",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_del_unauth.status_code == 404

    # User A deletes s1
    res_del = await async_client.delete(f"/api/specshield/sessions/{s1_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_del.status_code in (200, 204)

    # Verify s1 is gone
    res_get_deleted = await async_client.get(f"/api/specshield/sessions/{s1_id}",
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_get_deleted.status_code == 404
