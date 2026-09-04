import pytest
from httpx import AsyncClient
from backend.tests.test_diwaan import get_token

@pytest.mark.asyncio
async def test_auth_me_get_and_patch(async_client: AsyncClient):
    token = await get_token(async_client, "profile_user@example.com", "Original Tenant Name")

    # 1. GET /api/auth/me
    res_me = await async_client.get("/api/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_me.status_code == 200
    profile = res_me.json()
    assert profile["email"] == "profile_user@example.com"
    assert profile["tenant_name"] == "Original Tenant Name"

    # 2. PATCH /api/auth/me — Update tenant name only
    res_patch_name = await async_client.patch("/api/auth/me",
        json={"tenant_name": "Updated Enterprise Tenant"},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_patch_name.status_code == 200
    assert res_patch_name.json()["tenant_name"] == "Updated Enterprise Tenant"

    # 3. PATCH /api/auth/me — Invalid current password
    res_bad_pass = await async_client.patch("/api/auth/me",
        json={
            "current_password": "wrong_password",
            "new_password": "newpassword567"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_bad_pass.status_code == 400
    assert "Incorrect current password" in res_bad_pass.json()["error"]

    # 4. PATCH /api/auth/me — Valid password change
    res_change_pass = await async_client.patch("/api/auth/me",
        json={
            "current_password": "pass",
            "new_password": "newpassword567"
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_change_pass.status_code == 200

    # 5. Verify login with new password
    res_login = await async_client.post("/api/auth/login", data={
        "username": "profile_user@example.com",
        "password": "newpassword567"
    })
    assert res_login.status_code == 200
    assert "access_token" in res_login.json()
