from fastapi import APIRouter, Depends, Body, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from uuid import UUID, uuid4
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional

from ..db.session import get_db
from ..models.user import User
from ..models.diwaan import Archetype, TenantDashboard
from ..models.widget_data import WidgetValue, WidgetSeriesPoint, LedgerEvent
from ..schemas.blueprint import Blueprint, OnboardingRequest, ArchetypeClassification, sanitize_stored_widgets
from ..api.deps import get_current_user
from ..core.exceptions import APIError
from ..services.llm import generate_structured_output

router = APIRouter(prefix="/api", tags=["diwaan"])

class DashboardSummary(BaseModel):
    id: UUID
    name: str
    archetype_id: str
    business_summary: str
    generated_at: datetime
    last_opened_at: Optional[datetime]

class RenameRequest(BaseModel):
    name: str


@router.get("/dashboards", response_model=List[DashboardSummary])
async def list_dashboards(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TenantDashboard)
        .where(TenantDashboard.tenant_id == current_user.tenant_id)
    )
    dashboards = result.scalars().all()
    
    # Sort by COALESCE(last_opened_at, created_at) desc
    def sort_key(d):
        return d.last_opened_at or d.created_at
    
    dashboards.sort(key=sort_key, reverse=True)
    
    return [
        DashboardSummary(
            id=d.id,
            name=d.name,
            archetype_id=d.archetype_id,
            business_summary=d.business_summary,
            generated_at=d.generated_at,
            last_opened_at=d.last_opened_at
        ) for d in dashboards
    ]

@router.get("/dashboards/{id}")
async def get_dashboard(
    id: UUID = Path(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # First check if this is the compat shim for GET /api/dashboards/{tenant_id}
    if id == current_user.tenant_id:
        # Compat shim: return the most-recently-opened dashboard's Blueprint.
        # Deprecated: frontend must stop calling this.
        result = await db.execute(
            select(TenantDashboard)
            .where(TenantDashboard.tenant_id == current_user.tenant_id)
        )
        dashboards = result.scalars().all()
        if not dashboards:
            raise APIError("No dashboard found for tenant", status_code=404)
        
        dashboard = max(dashboards, key=lambda d: d.last_opened_at or d.created_at)
        
        return Blueprint(
            archetype=dashboard.archetype_id,
            visual_theme=(dashboard.customized_parameters or {}).get("visual_theme"),
            business_summary=dashboard.business_summary,
            customized_parameters=dashboard.customized_parameters,
            active_widgets=sanitize_stored_widgets(dashboard.active_widgets),
            generated_at=dashboard.generated_at,
            version=dashboard.version
        )
    
    # Normal route: {dashboard_id}
    result = await db.execute(
        select(TenantDashboard).where(TenantDashboard.id == id)
    )
    dashboard = result.scalar_one_or_none()
    
    if not dashboard or dashboard.tenant_id != current_user.tenant_id:
        raise APIError("Dashboard not found", status_code=404)
        
    dashboard.last_opened_at = datetime.now(timezone.utc)
    await db.commit()
    
    return Blueprint(
        archetype=dashboard.archetype_id,
        visual_theme=(dashboard.customized_parameters or {}).get("visual_theme"),
        business_summary=dashboard.business_summary,
        customized_parameters=dashboard.customized_parameters,
        active_widgets=sanitize_stored_widgets(dashboard.active_widgets),
        generated_at=dashboard.generated_at,
        version=dashboard.version
    )

@router.post("/dashboards/{dashboard_id}/rename", response_model=DashboardSummary)
async def rename_dashboard(
    dashboard_id: UUID,
    request: RenameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_name = request.name.strip()
    if not new_name:
        raise APIError("Name cannot be empty", status_code=400)
    if len(new_name) > 60:
        new_name = new_name[:60]
        
    result = await db.execute(select(TenantDashboard).where(TenantDashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    
    if not dashboard or dashboard.tenant_id != current_user.tenant_id:
        raise APIError("Dashboard not found", status_code=404)
        
    dashboard.name = new_name
    await db.commit()
    
    return DashboardSummary(
        id=dashboard.id,
        name=dashboard.name,
        archetype_id=dashboard.archetype_id,
        business_summary=dashboard.business_summary,
        generated_at=dashboard.generated_at,
        last_opened_at=dashboard.last_opened_at
    )

@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(TenantDashboard).where(TenantDashboard.id == dashboard_id))
    dashboard = result.scalar_one_or_none()
    
    if not dashboard or dashboard.tenant_id != current_user.tenant_id:
        raise APIError("Dashboard not found", status_code=404)

    # The FKs declare ON DELETE CASCADE, but SQLite does not enforce
    # foreign keys unless `PRAGMA foreign_keys=ON` is set per-connection
    # (it isn't, here) — so on SQLite the cascade silently never fires and
    # every widget row is left orphaned. Delete the children explicitly;
    # this is correct on SQLite and a harmless no-op-then-delete on
    # Postgres, where the DB cascade would have caught it anyway.
    await db.execute(delete(WidgetValue).where(WidgetValue.dashboard_id == dashboard_id))
    await db.execute(delete(WidgetSeriesPoint).where(WidgetSeriesPoint.dashboard_id == dashboard_id))
    await db.execute(delete(LedgerEvent).where(LedgerEvent.dashboard_id == dashboard_id))
    await db.delete(dashboard)
    await db.commit()

    return {"ok": True}


# Keep the old /onboarding/generate-blueprint for backward compatibility but update to create a new dashboard if it's used.
@router.post("/onboarding/generate-blueprint", response_model=Blueprint, deprecated=True)
async def generate_blueprint(
    request: OnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    classification_prompt = f"""
    Classify the following business description into one of these archetypes: farmer, shopkeeper, or factory_owner.
    Business Description: {request.business_description}
    """
    
    classification_result = await generate_structured_output(
        prompt=classification_prompt, 
        schema=ArchetypeClassification
    )
    archetype_id = classification_result.archetype
    
    result = await db.execute(select(Archetype).where(Archetype.id == archetype_id))
    archetype = result.scalar_one_or_none()
    if not archetype:
        raise APIError(f"Archetype '{archetype_id}' not found in database. Seed data missing.", status_code=500)
        
    mutation_prompt = f"""
    You are an AI generating a dashboard blueprint.
    Base Template: {archetype.base_template}
    Business Description: {request.business_description}
    Archetype: {archetype_id}
    """
    
    blueprint = await generate_structured_output(prompt=mutation_prompt, schema=Blueprint)
    
    params = dict(blueprint.customized_parameters)
    if blueprint.visual_theme:
        params["visual_theme"] = blueprint.visual_theme

    new_dashboard = TenantDashboard(
        id=uuid4(),
        tenant_id=current_user.tenant_id,
        name=blueprint.business_summary[:60] if blueprint.business_summary else "My Business",
        archetype_id=blueprint.archetype,
        business_summary=blueprint.business_summary,
        customized_parameters=params,
        active_widgets=[w.model_dump() for w in blueprint.active_widgets],
        generated_at=blueprint.generated_at,
        version=blueprint.version
    )
    db.add(new_dashboard)
    await db.commit()
    
    return blueprint
