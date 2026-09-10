"""
Widget data persistence models — Part II of the Diwaan data layer.

WidgetValue    — current value for any widget keyed by (tenant_id, key)
WidgetSeriesPoint — time-series points for metric/series widgets
LedgerEvent    — immutable log of LedgerToggle actions
"""
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Index
from backend.db.types import JSONType, UUIDType
from ..db.session import Base


class WidgetValue(Base):
    """
    Stores the current value of any dashboard widget for a tenant.
    Primary key is (tenant_id, key) — key is the DataBinding.key slug.
    value_json shape depends on DataBinding.kind:
      metric/series → {"value": float}
      table         → {"rows": [[cell, ...], ...]}
      status        → {"value": str}
      list          → {"items": [{"icon": str, "text": str, "meta": str, "dotColor": str}, ...]}
    """
    __tablename__ = "widget_values"

    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), primary_key=True, nullable=False)
    key = Column(String, primary_key=True, nullable=False)
    value_json = Column(JSONType, nullable=False, default=dict)
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    updated_by = Column(String, nullable=True)  # user email


class WidgetSeriesPoint(Base):
    """
    Time-series storage for MetricCard sparklines and ChartWidget histories.
    Every time a metric/series widget value is PUT, a point is appended here.
    """
    __tablename__ = "widget_series_points"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False)
    key = Column(String, nullable=False)
    ts = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    value = Column(Float, nullable=False)

    __table_args__ = (
        Index("ix_series_tenant_key_ts", "tenant_id", "key", "ts"),
    )


class LedgerEvent(Base):
    """
    Immutable log of LedgerToggle fires. Each POST to the actions endpoint
    appends a row here; the toggle never stores local state.
    """
    __tablename__ = "ledger_events"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False)
    key = Column(String, nullable=False)    # DataBinding.key of the LedgerToggle
    label = Column(String, nullable=False)  # Human-readable action label
    fired_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    fired_by = Column(String, nullable=True)   # user email
    note = Column(String, nullable=True)       # optional note from request body
