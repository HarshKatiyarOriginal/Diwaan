from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..db.session import Base

class Archetype(Base):
    __tablename__ = "archetypes"
    id = Column(String, primary_key=True) # e.g. "farmer", "shopkeeper", "factory_owner"
    base_template = Column(JSONB, nullable=False)

class TenantDashboard(Base):
    __tablename__ = "tenant_dashboards"
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), primary_key=True)
    archetype_id = Column(String, ForeignKey("archetypes.id"), nullable=False)
    business_summary = Column(String, nullable=False)
    customized_parameters = Column(JSONB, nullable=False, default={})
    active_widgets = Column(JSONB, nullable=False, default=[])
    generated_at = Column(DateTime, default=datetime.utcnow)
    version = Column(String, nullable=False, default="1.0")

    tenant = relationship("Tenant", back_populates="dashboards")
    archetype = relationship("Archetype")
