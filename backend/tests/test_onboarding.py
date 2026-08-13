import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import uuid4

from backend.models.onboarding import OnboardingSession
from backend.models.user import User
from backend.models.diwaan import TenantDashboard
from backend.schemas.onboarding import InterviewTurn
from backend.schemas.blueprint import Blueprint, ArchetypeClassification, WidgetConfig

@pytest.fixture
def mock_llm():
    with patch("backend.api.onboarding.generate_structured_output") as mock:
        yield mock

@pytest.mark.asyncio
async def test_onboarding_happy_path(async_client: AsyncClient, db_session: AsyncSession, test_user: dict, mock_llm):
    # 1. Start Session
    mock_llm.return_value = InterviewTurn(
        next_action="ask_question",
        question="What does your business do?",
        extracted_facts={}
    )
    
    headers = {"Authorization": f"Bearer {test_user['access_token']}"}
    response = await async_client.post("/api/onboarding/sessions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    session_id = data["session_id"]
    assert data["question"] == "What does your business do?"
    
    # 2. Respond (mid-interview)
    mock_llm.return_value = InterviewTurn(
        next_action="ask_question",
        question="How many employees do you have?",
        extracted_facts={"core_business": "Bicycle manufacturing"}
    )
    
    response = await async_client.post(
        f"/api/onboarding/sessions/{session_id}/respond",
        json={"answer": "We make bicycles."},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "in_progress"
    assert data["question"] == "How many employees do you have?"
    
    # Check data accumulation in DB
    result = await db_session.execute(select(OnboardingSession).where(OnboardingSession.id == session_id))
    session = result.scalar_one()
    assert session.collected_data == {"core_business": "Bicycle manufacturing"}
    
    # 3. Respond (ready_to_generate)
    # The endpoint will call classification then mutation LLM steps
    async def mock_llm_side_effect(*args, **kwargs):
        schema = kwargs.get("schema")
        if schema == InterviewTurn:
            return InterviewTurn(
                next_action="ready_to_generate",
                extracted_facts={"employees": 50}
            )
        elif schema == ArchetypeClassification:
            return ArchetypeClassification(archetype="factory_owner")
        elif schema == Blueprint:
            return Blueprint(
                archetype="factory_owner",
                business_summary="Cycle factory",
                customized_parameters={"primary_color": "#112233"},
                active_widgets=[
                    WidgetConfig(component_name="MetricCard", grid_position={"col_start":1, "col_span":2, "row_start":1, "row_span":1}, props={"title": "Revenue"})
                ]
            )
    
    mock_llm.side_effect = mock_llm_side_effect
    
    response = await async_client.post(
        f"/api/onboarding/sessions/{session_id}/respond",
        json={"answer": "We have 50 employees."},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "complete"
    assert data["blueprint"]["archetype"] == "factory_owner"
    
    # Verify DB state
    await db_session.refresh(session)
    assert session.status == "complete"
    assert session.resulting_dashboard_id is not None
    assert session.collected_data == {"core_business": "Bicycle manufacturing", "employees": 50}

@pytest.mark.asyncio
async def test_onboarding_tenant_isolation(async_client: AsyncClient, db_session: AsyncSession, test_user: dict):
    # Setup a session for a different tenant
    other_tenant_id = uuid4()
    other_session_id = uuid4()
    session = OnboardingSession(id=other_session_id, tenant_id=other_tenant_id)
    db_session.add(session)
    await db_session.commit()
    
    headers = {"Authorization": f"Bearer {test_user['access_token']}"}
    
    # 1. GET isolation
    response = await async_client.get(f"/api/onboarding/sessions/{other_session_id}", headers=headers)
    assert response.status_code == 404
    
    # 2. POST /respond isolation
    response = await async_client.post(
        f"/api/onboarding/sessions/{other_session_id}/respond",
        json={"answer": "Hacking your session"},
        headers=headers
    )
    assert response.status_code == 404

@pytest.mark.asyncio
async def test_onboarding_truncation(async_client: AsyncClient, db_session: AsyncSession, test_user: dict, mock_llm):
    # Mock LLM to constantly ask questions
    mock_llm.return_value = InterviewTurn(
        next_action="ask_question",
        question="Tell me more...",
        extracted_facts={"fact": "data"}
    )
    
    headers = {"Authorization": f"Bearer {test_user['access_token']}"}
    
    # Start
    response = await async_client.post("/api/onboarding/sessions", headers=headers)
    session_id = response.json()["session_id"]
    
    # Max questions is 15. The start_session uses 1. We must respond 14 times.
    for _ in range(13):
        res = await async_client.post(
            f"/api/onboarding/sessions/{session_id}/respond",
            json={"answer": "stuff"},
            headers=headers
        )
        assert res.json()["status"] == "in_progress"
        
    # On the 14th respond (15th question attempted), it should force generation.
    async def force_generate_side_effect(*args, **kwargs):
        schema = kwargs.get("schema")
        if schema == ArchetypeClassification:
            return ArchetypeClassification(archetype="shopkeeper")
        elif schema == Blueprint:
            return Blueprint(
                archetype="shopkeeper",
                business_summary="Mocked truncation",
                customized_parameters={},
                active_widgets=[]
            )
        return MagicMock() # Should not hit InterviewTurn
        
    mock_llm.side_effect = force_generate_side_effect
    
    res = await async_client.post(
        f"/api/onboarding/sessions/{session_id}/respond",
        json={"answer": "stuff"},
        headers=headers
    )
    data = res.json()
    assert data["status"] == "complete"
    assert data["blueprint"]["archetype"] == "shopkeeper"
    
    result = await db_session.execute(select(OnboardingSession).where(OnboardingSession.id == session_id))
    session = result.scalar_one()
    assert session.truncated is True
