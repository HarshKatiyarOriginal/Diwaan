"""
Dashboard Data API — Part II real data layer.

All endpoints are tenant-scoped via current_user.tenant_id.
Absolute isolation: every query filters by tenant_id.

GET  /api/dashboards/{tenant_id}/data           — fetch all current widget values
PUT  /api/dashboards/{tenant_id}/data/{key}     — upsert a widget value
POST /api/dashboards/{tenant_id}/actions/{key}  — fire a LedgerToggle event
GET  /api/dashboards/{tenant_id}/series/{key}   — time-series points for sparklines
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete
from pydantic import BaseModel, Field
from typing import Optional, Any
from uuid import UUID
from datetime import datetime, timezone, timedelta

from ..db.session import get_db
from ..models.user import User
from ..models.diwaan import TenantDashboard
from ..models.widget_data import WidgetValue, WidgetSeriesPoint, LedgerEvent
from ..api.deps import get_current_user
from ..core.exceptions import APIError

router = APIRouter(prefix="/api/dashboards", tags=["dashboard-data"])


# ── Request / response schemas ─────────────────────────────────────────────────

class WidgetValuePut(BaseModel):
    value: Any = Field(description="The new value. Shape must match DataBinding.kind.")
    note: Optional[str] = None


class LedgerActionRequest(BaseModel):
    label: str = Field(description="Human-readable description of the action being fired.")
    note: Optional[str] = None


class SeriesPoint(BaseModel):
    ts: datetime
    value: float


class WidgetValueResponse(BaseModel):
    key: str
    value_json: Any
    updated_at: Optional[datetime]
    updated_by: Optional[str]
    # For metric/series widgets: last two values for delta computation
    last_two: list[float] = []


class DashboardDataResponse(BaseModel):
    tenant_id: UUID
    data: dict[str, WidgetValueResponse]


class SeriesResponse(BaseModel):
    key: str
    points: list[SeriesPoint]


class LedgerEventResponse(BaseModel):
    id: UUID
    key: str
    label: str
    fired_at: datetime
    fired_by: Optional[str]
    note: Optional[str]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _assert_tenant(tenant_id: UUID, current_user: User) -> None:
    """Reject cross-tenant access with 403."""
    if tenant_id != current_user.tenant_id:
        raise APIError("Access denied: tenant mismatch.", status_code=403)


def _parse_range(range_str: str) -> datetime:
    """Convert range query param to a cutoff datetime."""
    mapping = {"30d": 30, "90d": 90, "1y": 365}
    days = mapping.get(range_str, 30)
    return datetime.now(timezone.utc) - timedelta(days=days)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{tenant_id}/data", response_model=DashboardDataResponse)
async def get_dashboard_data(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _assert_tenant(tenant_id, current_user)

    result = await db.execute(
        select(WidgetValue).where(WidgetValue.tenant_id == tenant_id)
    )
    rows = result.scalars().all()

    # For each metric/series value, fetch last 2 series points for delta
    data: dict[str, WidgetValueResponse] = {}
    for row in rows:
        last_two_pts = await db.execute(
            select(WidgetSeriesPoint)
            .where(
                WidgetSeriesPoint.tenant_id == tenant_id,
                WidgetSeriesPoint.key == row.key,
            )
            .order_by(WidgetSeriesPoint.ts.desc())
            .limit(2)
        )
        pts = last_two_pts.scalars().all()
        last_two = [p.value for p in pts]

        data[row.key] = WidgetValueResponse(
            key=row.key,
            value_json=row.value_json,
            updated_at=row.updated_at,
            updated_by=row.updated_by,
            last_two=last_two,
        )

    return DashboardDataResponse(tenant_id=tenant_id, data=data)


@router.put("/{tenant_id}/data/{key}")
async def put_widget_value(
    tenant_id: UUID,
    key: str,
    body: WidgetValuePut,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _assert_tenant(tenant_id, current_user)

    # Validate key exists in the dashboard's binding catalog
    dash_res = await db.execute(
        select(TenantDashboard).where(TenantDashboard.tenant_id == tenant_id)
    )
    dash = dash_res.scalar_one_or_none()
    if not dash:
        raise APIError("Dashboard not found", status_code=404)

    catalog = (dash.customized_parameters or {}).get("binding_catalog", [])
    valid_keys = {entry["key"] for entry in catalog if isinstance(entry, dict) and "key" in entry}

    # Also accept keys directly from active_widgets data_binding
    for widget in (dash.active_widgets or []):
        if isinstance(widget, dict):
            db_field = widget.get("data_binding")
            if isinstance(db_field, dict) and db_field.get("key"):
                valid_keys.add(db_field["key"])

    # The key MUST be a declared data binding on this dashboard. An empty
    # catalog (legacy / thin dashboard) therefore rejects every write —
    # it does NOT wave the check through.
    if key not in valid_keys:
        detail = (
            " This dashboard has no data-bound widgets."
            if not valid_keys else ""
        )
        raise APIError(
            f"Key '{key}' is not in this dashboard's data bindings.{detail}",
            status_code=422,
            details={"valid_keys": sorted(valid_keys)},
        )

    # Upsert WidgetValue
    existing_res = await db.execute(
        select(WidgetValue).where(
            WidgetValue.tenant_id == tenant_id,
            WidgetValue.key == key,
        )
    )
    existing = existing_res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    user_email = getattr(current_user, "email", None)

    if existing:
        existing.value_json = {"value": body.value}
        existing.updated_at = now
        existing.updated_by = user_email
    else:
        db.add(WidgetValue(
            tenant_id=tenant_id,
            key=key,
            value_json={"value": body.value},
            updated_at=now,
            updated_by=user_email,
        ))

    # Append a series point if the value is numeric (for metric/series bindings)
    try:
        numeric_val = float(body.value)
        db.add(WidgetSeriesPoint(
            tenant_id=tenant_id,
            key=key,
            ts=now,
            value=numeric_val,
        ))
    except (TypeError, ValueError):
        pass  # Non-numeric values (status strings, table rows) don't generate series points

    await db.commit()
    return {"ok": True, "key": key, "updated_at": now.isoformat()}


@router.post("/{tenant_id}/actions/{key}")
async def fire_ledger_action(
    tenant_id: UUID,
    key: str,
    body: LedgerActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _assert_tenant(tenant_id, current_user)

    user_email = getattr(current_user, "email", None)
    event = LedgerEvent(
        tenant_id=tenant_id,
        key=key,
        label=body.label,
        fired_at=datetime.now(timezone.utc),
        fired_by=user_email,
        note=body.note,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    return LedgerEventResponse(
        id=event.id,
        key=event.key,
        label=event.label,
        fired_at=event.fired_at,
        fired_by=event.fired_by,
        note=event.note,
    )


@router.get("/{tenant_id}/series/{key}", response_model=SeriesResponse)
async def get_widget_series(
    tenant_id: UUID,
    key: str,
    range: str = Query(default="30d", pattern="^(30d|90d|1y)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _assert_tenant(tenant_id, current_user)

    cutoff = _parse_range(range)
    result = await db.execute(
        select(WidgetSeriesPoint)
        .where(
            WidgetSeriesPoint.tenant_id == tenant_id,
            WidgetSeriesPoint.key == key,
            WidgetSeriesPoint.ts >= cutoff,
        )
        .order_by(WidgetSeriesPoint.ts.asc())
    )
    points = result.scalars().all()

    return SeriesResponse(
        key=key,
        points=[SeriesPoint(ts=p.ts, value=p.value) for p in points],
    )


@router.get("/{tenant_id}/actions/{key}", response_model=list[LedgerEventResponse])
async def get_ledger_events(
    tenant_id: UUID,
    key: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the event log for a LedgerToggle, most recent first."""
    _assert_tenant(tenant_id, current_user)

    result = await db.execute(
        select(LedgerEvent)
        .where(LedgerEvent.tenant_id == tenant_id, LedgerEvent.key == key)
        .order_by(LedgerEvent.fired_at.desc())
        .limit(50)
    )
    events = result.scalars().all()

    return [
        LedgerEventResponse(
            id=e.id,
            key=e.key,
            label=e.label,
            fired_at=e.fired_at,
            fired_by=e.fired_by,
            note=e.note,
        )
        for e in events
    ]
