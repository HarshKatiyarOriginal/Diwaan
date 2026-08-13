from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID

from ..db.session import get_db
from ..models.user import User
from ..models.diwaan import Archetype, TenantDashboard
from ..schemas.blueprint import Blueprint, OnboardingRequest, ArchetypeClassification
from ..api.deps import get_current_user
from ..core.exceptions import APIError
from ..services.llm import generate_structured_output

router = APIRouter(prefix="/api", tags=["diwaan"])

@router.post("/onboarding/generate-blueprint", response_model=Blueprint)
async def generate_blueprint(
    request: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Step 1: LLM Classification
    classification_prompt = f"""
    Classify the following business description into one of these archetypes: farmer, shopkeeper, or factory_owner.
    Business Description: {request.business_description}
    """
    
    classification_result = await generate_structured_output(
        prompt=classification_prompt, 
        schema=ArchetypeClassification
    )
    archetype_id = classification_result.archetype
    
    # Step 2: Load Archetype Base Template
    result = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = result.scalar_one_or_none()
    
    if not archetype:
        raise APIError(f"Archetype '{archetype_id}' not found in database. Seed data missing.", status_code=500)
        
    # Step 3: LLM Mutation
    mutation_prompt = f"""
    You are an AI generating a dashboard blueprint.
    Base Template: {archetype.base_template}
    Business Description: {request.business_description}
    Archetype: {archetype_id}
    
    Task: Return a new Blueprint JSON object. You may add, remove, or modify active_widgets and customized_parameters based on the business description.
    IMPORTANT: Every widget's `component_name` MUST be one of: MetricCard, DataTable, ChartWidget, StatusBadge, LedgerToggle, ListWidget. Do NOT invent new component names.
    """
    
    blueprint = await generate_structured_output(
        prompt=mutation_prompt,
        schema=Blueprint
    )
    
    # Step 4: Persist
    # Upsert dashboard for tenant
    result = await db.execute(select(TenantDashboard).where(TenantDashboard.tenant_id == current_user.tenant_id))
    existing_dashboard = result.scalar_one_or_none()
    
    if existing_dashboard:
        existing_dashboard.archetype_id = blueprint.archetype
        existing_dashboard.business_summary = blueprint.business_summary
        existing_dashboard.customized_parameters = blueprint.customized_parameters
        existing_dashboard.active_widgets = [w.model_dump() for w in blueprint.active_widgets]
        existing_dashboard.generated_at = blueprint.generated_at
        existing_dashboard.version = blueprint.version
    else:
        new_dashboard = TenantDashboard(
            tenant_id=current_user.tenant_id,
            archetype_id=blueprint.archetype,
            business_summary=blueprint.business_summary,
            customized_parameters=blueprint.customized_parameters,
            active_widgets=[w.model_dump() for w in blueprint.active_widgets],
            generated_at=blueprint.generated_at,
            version=blueprint.version
        )
        db.add(new_dashboard)
        
    await db.commit()
    
    return blueprint

@router.get("/dashboards/{tenant_id}", response_model=Blueprint)
async def get_dashboard(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if tenant_id != current_user.tenant_id:
        raise APIError("Unauthorized to access this tenant's dashboard", status_code=403)
        
    result = await db.execute(select(TenantDashboard).where(TenantDashboard.tenant_id == tenant_id))
    dashboard = result.scalar_one_or_none()
    
    if not dashboard:
        raise APIError("Dashboard not found", status_code=404)
        
    # Reconstruct Blueprint from DB
    return Blueprint(
        archetype=dashboard.archetype_id,
        business_summary=dashboard.business_summary,
        customized_parameters=dashboard.customized_parameters,
        active_widgets=dashboard.active_widgets,
        generated_at=dashboard.generated_at,
        version=dashboard.version
    )
