from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid
from datetime import datetime, timezone

from ..db.session import Base

class OnboardingSession(Base):
    __tablename__ = "onboarding_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("users.tenant_id"), nullable=False, index=True)
    
    # status: in_progress, ready_to_generate, complete, abandoned
    status = Column(String, nullable=False, default="in_progress")
    
    # conversation history
    conversation = Column(JSONB, nullable=False, default=list)
    
    # structured facts extracted by the AI
    collected_data = Column(JSONB, nullable=False, default=dict)
    
    # whether the session hit the max question cap
    truncated = Column(Boolean, nullable=False, default=False)
    
    # foreign key to the generated dashboard
    resulting_dashboard_id = Column(UUID(as_uuid=True), ForeignKey("tenant_dashboards.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
