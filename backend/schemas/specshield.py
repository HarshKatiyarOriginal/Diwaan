from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class AuditSessionCreate(BaseModel):
    project_name: str

class AuditSessionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    project_name: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class SpecParam(BaseModel):
    param: str
    label: str
    value: str

class DocumentSpecsExtracted(BaseModel):
    specs: List[SpecParam]

class ComparisonResultResponse(BaseModel):
    id: UUID
    parameter: str
    blueprint_value: Optional[str]
    invoice_value: Optional[str]
    is_match: bool
    severity: str
    
    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: UUID
    doc_type: str
    filename: str
    status: str
    specs: Optional[List[SpecParam]]
    
    class Config:
        from_attributes = True

class FullSessionResponse(BaseModel):
    session: AuditSessionResponse
    documents: List[DocumentResponse]
    comparisons: List[ComparisonResultResponse]
