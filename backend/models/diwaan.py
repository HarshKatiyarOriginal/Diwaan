from sqlalchemy import Column, String, DateTime, ForeignKey
from backend.db.types import JSONType, UUIDType
from sqlalchemy.orm import relationship
from datetime import datetime
from ..db.session import Base


import uuid

class Archetype(Base):
    __tablename__ = "archetypes"
    id = Column(String, primary_key=True)  # e.g. "farmer", "shopkeeper", "factory_owner"
    base_template = Column(JSONType, nullable=False)


class TenantDashboard(Base):
    __tablename__ = "tenant_dashboards"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    archetype_id = Column(String, ForeignKey("archetypes.id"), nullable=False)
    business_summary = Column(String, nullable=False)
    customized_parameters = Column(JSONType, nullable=False, default={})
    active_widgets = Column(JSONType, nullable=False, default=[])
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_opened_at = Column(DateTime, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    version = Column(String, nullable=False, default="1.0")

    tenant = relationship("Tenant", back_populates="dashboards")
    archetype = relationship("Archetype")
