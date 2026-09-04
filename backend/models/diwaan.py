from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, UUID
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..db.session import Base

JSONType = JSON().with_variant(JSONB, "postgresql")
UUIDType = UUID(as_uuid=True).with_variant(PG_UUID(as_uuid=True), "postgresql")

class Archetype(Base):
    __tablename__ = "archetypes"
    id = Column(String, primary_key=True) # e.g. "farmer", "shopkeeper", "factory_owner"
    base_template = Column(JSONType, nullable=False)

class TenantDashboard(Base):
    __tablename__ = "tenant_dashboards"
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), primary_key=True)
    archetype_id = Column(String, ForeignKey("archetypes.id"), nullable=False)
    business_summary = Column(String, nullable=False)
    customized_parameters = Column(JSONType, nullable=False, default={})
    active_widgets = Column(JSONType, nullable=False, default=[])
    generated_at = Column(DateTime, default=datetime.utcnow)
    version = Column(String, nullable=False, default="1.0")

    tenant = relationship("Tenant", back_populates="dashboards")
    archetype = relationship("Archetype")
