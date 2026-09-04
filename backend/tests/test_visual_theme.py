import pytest
from httpx import AsyncClient
from backend.schemas.blueprint import Blueprint, VISUAL_THEME_IDS, ArchetypeClassification
from backend.schemas.onboarding import InterviewTurn
from datetime import datetime, timezone
import base64
import json
from unittest.mock import patch


def decode_jwt(token: str) -> dict:
    parts = token.split(".")
    b64 = parts[1].replace("-", "+").replace("_", "/")
    pad = len(b64) % 4
    if pad:
        b64 += "=" * (4 - pad)
    return json.loads(base64.b64decode(b64))


def test_visual_theme_schema_validation():
    # Test valid theme
    bp = Blueprint(
        archetype="factory_owner",
        visual_theme="tiles-factory",
        business_summary="Tile plant",
        generated_at=datetime.now(timezone.utc),
    )
    assert bp.visual_theme == "tiles-factory"

    # Test None theme (optional)
    bp_none = Blueprint(
        archetype="farmer",
        business_summary="Farm",
        generated_at=datetime.now(timezone.utc),
    )
    assert bp_none.visual_theme is None

    # Test VISUAL_THEME_IDS tuple contains expected 5 themes
    expected_themes = {
        "kirana-shop",
        "farm",
        "paper-factory",
        "ice-cream-factory",
        "tiles-factory",
    }
    assert set(VISUAL_THEME_IDS) == expected_themes


@pytest.mark.asyncio
async def test_visual_theme_roundtrips_generate_blueprint_and_dashboard_endpoint(async_client: AsyncClient):
    # Register & Login
    await async_client.post("/api/auth/register", json={
        "email": "theme_test@example.com",
        "password": "password123",
        "tenant_name": "Ice Cream Factory Tenant"
    })
    login_res = await async_client.post("/api/auth/login", data={"username": "theme_test@example.com", "password": "password123"})
    token = login_res.json()["access_token"]
    payload = decode_jwt(token)
    tenant_id = payload["tenant_id"]

    headers = {"Authorization": f"Bearer {token}"}

    # Generate blueprint via /api/onboarding/generate-blueprint
    mock_classification = ArchetypeClassification(archetype="factory_owner")
    mock_blueprint = Blueprint(
        archetype="factory_owner",
        visual_theme="ice-cream-factory",
        business_summary="Ice Cream Production Plant",
        customized_parameters={"cold_chain": True},
        active_widgets=[],
        generated_at=datetime.now(timezone.utc),
        version="1.0"
    )

    with patch("backend.api.diwaan.generate_structured_output", side_effect=[mock_classification, mock_blueprint]):
        gen_res = await async_client.post(
            "/api/onboarding/generate-blueprint",
            json={"business_description": "Ice cream manufacturing business"},
            headers=headers
        )
        assert gen_res.status_code == 200

    # Test GET /api/dashboards/{tenant_id} returns visual_theme
    dash_res = await async_client.get(f"/api/dashboards/{tenant_id}", headers=headers)
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["visual_theme"] == "ice-cream-factory"


@pytest.mark.asyncio
async def test_get_session_returns_visual_theme_on_completed_onboarding_session(async_client: AsyncClient):
    # Register & Login
    await async_client.post("/api/auth/register", json={
        "email": "session_theme_test@example.com",
        "password": "password123",
        "tenant_name": "Tile Factory Tenant"
    })
    login_res = await async_client.post("/api/auth/login", data={"username": "session_theme_test@example.com", "password": "password123"})
    token = login_res.json()["access_token"]
    payload = decode_jwt(token)
    tenant_id = payload["tenant_id"]

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start onboarding session
    mock_turn1 = InterviewTurn(question="What kind of tiles do you manufacture?", next_action="ask_question", extracted_facts={})
    with patch("backend.api.onboarding.generate_structured_output", return_value=mock_turn1):
        start_res = await async_client.post("/api/onboarding/sessions", headers=headers)
        assert start_res.status_code == 200
        session_id = start_res.json()["session_id"]

    # 2. Respond to session and trigger blueprint generation
    mock_turn2 = InterviewTurn(question="", next_action="ready_to_generate", extracted_facts={"product": "Ceramic Tiles"})
    mock_classification = ArchetypeClassification(archetype="factory_owner")
    mock_blueprint = Blueprint(
        archetype="factory_owner",
        visual_theme="tiles-factory",
        business_summary="Ceramic tile manufacturing plant",
        customized_parameters={"kiln_temp": 1200},
        active_widgets=[],
        generated_at=datetime.now(timezone.utc),
        version="1.0"
    )

    with patch("backend.api.onboarding.generate_structured_output", side_effect=[mock_turn2, mock_classification, mock_blueprint]):
        respond_res = await async_client.post(
            f"/api/onboarding/sessions/{session_id}/respond",
            json={"answer": "We make high-temperature ceramic floor tiles."},
            headers=headers
        )
        assert respond_res.status_code == 200
        assert respond_res.json()["status"] == "complete"
        assert respond_res.json()["blueprint"]["visual_theme"] == "tiles-factory"

    # 3. Hit GET /api/onboarding/sessions/{session_id} and assert visual_theme is present on reconstructed blueprint
    get_sess_res = await async_client.get(f"/api/onboarding/sessions/{session_id}", headers=headers)
    assert get_sess_res.status_code == 200
    sess_body = get_sess_res.json()
    assert sess_body["status"] == "complete"
    assert sess_body["blueprint"] is not None
    assert sess_body["blueprint"]["visual_theme"] == "tiles-factory"

    # 4. Also hit GET /api/dashboards/{tenant_id} and verify visual_theme matches
    dash_res = await async_client.get(f"/api/dashboards/{tenant_id}", headers=headers)
    assert dash_res.status_code == 200
    assert dash_res.json()["visual_theme"] == "tiles-factory"
