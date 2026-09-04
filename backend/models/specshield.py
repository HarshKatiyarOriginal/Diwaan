from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from backend.db.types import JSONType, UUIDType
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..db.session import Base


class AuditSession(Base):
    __tablename__ = "audit_sessions"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUIDType, ForeignKey("tenants.id"), nullable=False)
    project_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="audit_sessions")
    documents = relationship("Document", back_populates="session", cascade="all, delete-orphan")
    comparisons = relationship("ComparisonResult", back_populates="session", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUIDType, ForeignKey("audit_sessions.id"), nullable=False)
    doc_type = Column(String, nullable=False)  # blueprint, invoice, site-plan
    filename = Column(String, nullable=False)
    storage_uri = Column(String, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending, processed, manual_review_required, error
    specs = Column(JSONType, nullable=True)  # Normalized extracted specs array

    session = relationship("AuditSession", back_populates="documents")


class ComparisonResult(Base):
    __tablename__ = "comparison_results"
    id = Column(UUIDType, primary_key=True, default=uuid.uuid4)
    session_id = Column(UUIDType, ForeignKey("audit_sessions.id"), nullable=False)
    parameter = Column(String, nullable=False)
    blueprint_value = Column(String, nullable=True)
    invoice_value = Column(String, nullable=True)
    is_match = Column(Boolean, nullable=False)
    severity = Column(String, nullable=False, default="LOW")  # LOW, MEDIUM, HIGH

    session = relationship("AuditSession", back_populates="comparisons")
