from sqlalchemy import Column, String, Boolean, ForeignKey, UUID
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
import uuid
from ..db.session import Base

UUIDType = UUID(as_uuid=True).with_variant(PG_UUID(as_uuid=True), "postgresql")

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    
    users = relationship("User", back_populates="tenant")
    dashboards = relationship("TenantDashboard", back_populates="tenant")
    audit_sessions = relationship("AuditSession", back_populates="tenant")

class User(Base):
    __tablename__ = "users"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False)
    
    tenant = relationship("Tenant", back_populates="users")
