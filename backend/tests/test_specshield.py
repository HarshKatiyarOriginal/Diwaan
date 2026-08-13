import pytest
from httpx import AsyncClient
from backend.tests.test_diwaan import get_token
import uuid

@pytest.mark.asyncio
async def test_tenant_isolation_specshield(async_client: AsyncClient):
    token_a = await get_token(async_client, "a@example.com", "Tenant A")
    
    # Create session for User A
    res_create = await async_client.post("/api/specshield/sessions", 
        json={"project_name": "Project A"},
        headers={"Authorization": f"Bearer {token_a}"}
    )
    assert res_create.status_code == 200
    session_id_a = res_create.json()["id"]
    
    token_b = await get_token(async_client, "b@example.com", "Tenant B")
    
    # User B attempts to GET User A's session
    res_get = await async_client.get(f"/api/specshield/sessions/{session_id_a}", 
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res_get.status_code == 404 # 404 because query filters by tenant_id

@pytest.mark.asyncio
async def test_dwg_upload_rejected_from_pipeline(async_client: AsyncClient):
    token = await get_token(async_client, "c@example.com", "Tenant C")
    
    # Create session
    session_id = (await async_client.post("/api/specshield/sessions", 
        json={"project_name": "Project C"},
        headers={"Authorization": f"Bearer {token}"}
    )).json()["id"]
    
    # Upload DWG
    with open("dummy.dwg", "wb") as f:
        f.write(b"dummy dwg content")
        
    with open("dummy.dwg", "rb") as f:
        res = await async_client.post(
            f"/api/specshield/sessions/{session_id}/documents",
            data={"doc_type": "site-plan"},
            files={"file": ("dummy.dwg", f, "image/vnd.dwg")},
            headers={"Authorization": f"Bearer {token}"}
        )
        
    assert res.status_code == 202
    assert res.json()["status"] == "manual_review_required"
    assert "DWG" in res.json()["message"]
