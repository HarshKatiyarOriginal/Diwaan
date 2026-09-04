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

    # conversation history
    conversation = Column(JSONType, nullable=False, default=list)

    # structured facts extracted by the AI
    collected_data = Column(JSONType, nullable=False, default=dict)

    # whether the session hit the max question cap
    truncated = Column(Boolean, nullable=False, default=False)

    # foreign key to the generated dashboard
    resulting_dashboard_id = Column(UUIDType, ForeignKey("tenant_dashboards.tenant_id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
