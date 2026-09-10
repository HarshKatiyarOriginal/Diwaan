from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from backend.db.types import JSONType, UUIDType
import uuid
from datetime import datetime, timezone
from ..db.session import Base


class OnboardingSession(Base):
    __tablename__ = "onboarding_sessions"

    id = Column(UUIDType, primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False, index=True)

    # status: in_progress, ready_to_generate, complete, abandoned
    status = Column(String, nullable=False, default="in_progress")

    # conversation history as [{role, content}] dicts
    conversation = Column(JSONType, nullable=False, default=list)

    # structured facts extracted by the AI (flat key/value dict)
    collected_data = Column(JSONType, nullable=False, default=dict)

    # ── Coverage model ────────────────────────────────────────────────────────
    # Merged coverage map: {dimension_key: "covered"|"partial"|"n/a"|"uncovered"}
    # Updated incrementally turn by turn.
    coverage_map = Column(JSONType, nullable=False, default=dict)

    # Accumulated DataBinding catalog — list of DataBinding dicts.
    # Each entry represents a real data point for this business's dashboard.
    binding_catalog = Column(JSONType, nullable=False, default=list)

    # Logged at truncation (question cap hit): list of uncovered core dimension keys.
    uncovered_core_at_truncation = Column(JSONType, nullable=True)

    # whether the session hit the max question cap
    truncated = Column(Boolean, nullable=False, default=False)

    # foreign key to the generated dashboard
    resulting_dashboard_id = Column(
        UUIDType, ForeignKey("tenant_dashboards.tenant_id"), nullable=True
    )

    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
