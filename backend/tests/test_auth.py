import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_and_login(async_client: AsyncClient):
    # Register
    reg_res = await async_client.post("/api/auth/register", json={
        "email": "test@example.com",
        "password": "password123",
        "tenant_name": "Test Factory"
    })
    assert reg_res.status_code == 200
    user = reg_res.json()
    assert user["email"] == "test@example.com"
    assert "id" in user
    assert "tenant_id" in user
    
    # Login
    login_res = await async_client.post("/api/auth/login", data={
        "username": "test@example.com",
        "password": "password123"
    })
    assert login_res.status_code == 200
    token = login_res.json()
    assert "access_token" in token
    assert token["token_type"] == "bearer"
