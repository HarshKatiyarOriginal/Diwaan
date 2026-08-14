from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
import json
import logging

from ..db.session import get_db
from ..models.user import User
from ..models.onboarding import OnboardingSession
from ..models.diwaan import Archetype, TenantDashboard
from ..schemas.onboarding import StartInterviewResponse, RespondRequest, RespondResponse, InterviewTurn
from ..schemas.blueprint import Blueprint, ArchetypeClassification
from ..api.deps import get_current_user
from ..core.exceptions import APIError
from ..services.llm import generate_structured_output

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

ONBOARDING_MAX_QUESTIONS = 15

SYSTEM_PROMPT = """You are a domain-aware business consultant conducting a real intake interview to design a business intelligence dashboard.
Your goal is to gather specific facts about the user's business (workforce, equipment, products, costs, suppliers, regulatory scale).
Do not ask generic 'tell me more' questions. Ground your questions in reality.
Only ask ONE question at a time in plain language. No jargon.
Every question must be answerable with a concrete fact (a number, a name, a yes/no, a specific choice).
Actively check the facts you have already extracted from prior answers before asking a new question. DO NOT ask something you can already infer or have already collected.
Prioritize questions that will materially change what the dashboard looks like (things that map to a widget or a metric) over background color/flavor questions.
When you have enough facts to confidently generate a comprehensive dashboard blueprint, output next_action as "ready_to_generate".
"""

def format_conversation(conversation: list) -> str:
    formatted = [SYSTEM_PROMPT]
    for turn in conversation:
        formatted.append(f"{turn['role'].capitalize()}: {turn['content']}")
    return "\n\n".join(formatted)

@router.post("/sessions", response_model=StartInterviewResponse)
async def start_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    session = OnboardingSession(tenant_id=current_user.tenant_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    prompt = f"{SYSTEM_PROMPT}\n\nStart the interview by asking the first question about what their business does."
    
    turn = await generate_structured_output(prompt=prompt, schema=InterviewTurn)
    
    # Store history
    session.conversation = [
        {"role": "assistant", "content": turn.question}
    ]
    await db.commit()
    
    return StartInterviewResponse(session_id=session.id, question=turn.question)

@router.post("/sessions/{session_id}/respond", response_model=RespondResponse)
async def respond(
    session_id: UUID,
    request: RespondRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(OnboardingSession).where(
        OnboardingSession.id == session_id,
        OnboardingSession.tenant_id == current_user.tenant_id
    ))
    session = result.scalar_one_or_none()
    
    if not session:
        raise APIError("Session not found", status_code=404)
        
    if session.status != "in_progress":
        raise APIError(f"Session is already {session.status}", status_code=400)
        
    # Append user answer
    conversation = list(session.conversation)
    conversation.append({"role": "user", "content": request.answer})
    
    # Calculate questions asked (assistant turns)
    questions_asked = sum(1 for t in conversation if t["role"] == "assistant")
    
    force_generation = False
    if questions_asked >= ONBOARDING_MAX_QUESTIONS:
        force_generation = True
        session.truncated = True
        turn_action = "ready_to_generate"
        turn_extracted_facts = {}
    else:
        # LLM call
        prompt = format_conversation(conversation)
        turn = await generate_structured_output(prompt=prompt, schema=InterviewTurn)
        
        # Merge facts
        if turn.extracted_facts:
            current_data = dict(session.collected_data)
            current_data.update(turn.extracted_facts)
            session.collected_data = current_data
            
        turn_action = turn.next_action
        
        if turn_action == "ask_question":
            conversation.append({"role": "assistant", "content": turn.question})
            session.conversation = conversation
            await db.commit()
            return RespondResponse(session_id=session.id, status="in_progress", question=turn.question)

    # ready_to_generate OR forced
    session.conversation = conversation
    business_context = json.dumps(session.collected_data, indent=2)
    
    # 1. Classify
    classification_prompt = f"""
    Classify the following business data into one of these archetypes: farmer, shopkeeper, or factory_owner.
    Business Data: {business_context}
    """
    
    classification_result = await generate_structured_output(
        prompt=classification_prompt, 
        schema=ArchetypeClassification
    )
    archetype_id = classification_result.archetype
    
    # 2. Mutate
    arch_res = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = arch_res.scalar_one_or_none()
    
    if not archetype:
        raise APIError(f"Archetype '{archetype_id}' not found in database.", status_code=500)
        
    mutation_prompt = f"""
    You are an AI generating a dashboard blueprint.
    Base Template: {archetype.base_template}
    Business Data: {business_context}
    Archetype: {archetype_id}
    
    Task: Return a new Blueprint JSON object. You may add, remove, or modify active_widgets and customized_parameters based on the business data.
    IMPORTANT: Every widget's `component_name` MUST be one of: MetricCard, DataTable, ChartWidget, StatusBadge, LedgerToggle, ListWidget. Do NOT invent new component names.
    CRITICAL INSTRUCTION: Every MetricCard/DataTable/ChartWidget you generate must be traceable directly to a specific fact in Business Data below. If a fact is missing for a metric you'd normally include, omit the widget entirely rather than fabricating a placeholder value or specific-sounding estimate.
    """
    
    blueprint = await generate_structured_output(prompt=mutation_prompt, schema=Blueprint)
    
    # 3. Upsert Dashboard
    dash_res = await db.execute(select(TenantDashboard).where(TenantDashboard.tenant_id == current_user.tenant_id))
    existing_dashboard = dash_res.scalar_one_or_none()
    
    if existing_dashboard:
        existing_dashboard.archetype_id = blueprint.archetype
        existing_dashboard.business_summary = blueprint.business_summary
        existing_dashboard.customized_parameters = blueprint.customized_parameters
        existing_dashboard.active_widgets = [w.model_dump() for w in blueprint.active_widgets]
        existing_dashboard.generated_at = blueprint.generated_at
        existing_dashboard.version = blueprint.version
        dash = existing_dashboard
    else:
        dash = TenantDashboard(
            tenant_id=current_user.tenant_id,
            archetype_id=blueprint.archetype,
            business_summary=blueprint.business_summary,
            customized_parameters=blueprint.customized_parameters,
            active_widgets=[w.model_dump() for w in blueprint.active_widgets],
            generated_at=blueprint.generated_at,
            version=blueprint.version
        )
        db.add(dash)
    
    await db.commit()
    await db.refresh(dash)
    
    session.status = "complete"
    session.resulting_dashboard_id = dash.id
    await db.commit()
    
    return RespondResponse(
        session_id=session.id,
        status="complete",
        blueprint=blueprint
    )

@router.get("/sessions/{session_id}", response_model=RespondResponse)
async def get_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(OnboardingSession).where(
        OnboardingSession.id == session_id,
        OnboardingSession.tenant_id == current_user.tenant_id
    ))
    session = result.scalar_one_or_none()
    
    if not session:
        raise APIError("Session not found", status_code=404)
        
    last_question = None
    if session.status == "in_progress" and session.conversation:
        last_turn = session.conversation[-1]
        if last_turn["role"] == "assistant":
            last_question = last_turn["content"]
            
    blueprint = None
    if session.status == "complete" and session.resulting_dashboard_id:
        dash_res = await db.execute(select(TenantDashboard).where(TenantDashboard.id == session.resulting_dashboard_id))
        dash = dash_res.scalar_one_or_none()
        if dash:
            blueprint = Blueprint(
                archetype=dash.archetype_id,
                business_summary=dash.business_summary,
                customized_parameters=dash.customized_parameters,
                active_widgets=dash.active_widgets,
                generated_at=dash.generated_at,
                version=dash.version
            )
            
    return RespondResponse(
        session_id=session.id,
        status=session.status,
        question=last_question,
        blueprint=blueprint
    )
