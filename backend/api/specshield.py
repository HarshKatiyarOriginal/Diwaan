from fastapi import APIRouter, Depends, UploadFile, File, Form, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
import magic
from typing import List

from ..db.session import get_db
from ..models.user import User
from ..models.specshield import AuditSession, Document, ComparisonResult
from ..schemas.specshield import AuditSessionCreate, AuditSessionResponse, FullSessionResponse, DocumentResponse, ComparisonResultResponse
from ..api.deps import get_current_user
from ..core.exceptions import APIError
from ..core.storage import storage

router = APIRouter(prefix="/api/specshield", tags=["specshield"])

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB


@router.get("/sessions", response_model=List[AuditSessionResponse])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession)
        .where(AuditSession.tenant_id == current_user.tenant_id)
        .order_by(AuditSession.created_at.desc())
    )
    return result.scalars().all()


@router.post("/sessions", response_model=AuditSessionResponse)
async def create_session(
    session_in: AuditSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_session = AuditSession(
        tenant_id=current_user.tenant_id,
        project_name=session_in.project_name
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    return new_session


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(
            AuditSession.id == session_id,
            AuditSession.tenant_id == current_user.tenant_id
        )
    )
    audit_session = result.scalar_one_or_none()
    if not audit_session:
        raise APIError("Session not found or unauthorized", status_code=404)

    await db.delete(audit_session)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_id}/documents", status_code=202)
async def upload_document(
    session_id: UUID,
    doc_type: str = Form(...),  # blueprint, invoice, site-plan
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditSession).where(AuditSession.id == session_id, AuditSession.tenant_id == current_user.tenant_id))
    audit_session = result.scalar_one_or_none()
    if not audit_session:
        raise APIError("Session not found or unauthorized", status_code=404)

    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise APIError("File exceeds maximum size of 25MB", status_code=413)

    mime_type = magic.from_buffer(file_content, mime=True)

    if file.filename.lower().endswith(".dwg") or mime_type in ["image/vnd.dwg"]:
        doc_status = "manual_review_required"
        skip_pipeline = True
    elif mime_type not in ["application/pdf", "image/jpeg", "image/png"]:
        raise APIError(f"Unsupported file type: {mime_type}. Must be PDF or Image.", status_code=415)
    else:
        doc_status = "pending"
        skip_pipeline = False

    await file.seek(0)

    safe_filename = f"{session_id}_{file.filename}"
    storage_uri = await storage.save(file, safe_filename)

    document = Document(
        session_id=session_id,
        doc_type=doc_type,
        filename=file.filename,
        storage_uri=storage_uri,
        status=doc_status
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    if skip_pipeline:
        return {"document_id": document.id, "status": "manual_review_required", "message": "DWG files are not supported by the automated pipeline."}

    from ..worker.tasks import parse_document
    task = parse_document.delay(str(document.id), str(current_user.tenant_id))

    return {"document_id": document.id, "task_id": task.id, "status": "processing"}


@router.get("/sessions/{session_id}", response_model=FullSessionResponse)
async def get_session_state(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditSession).where(AuditSession.id == session_id, AuditSession.tenant_id == current_user.tenant_id))
    audit_session = result.scalar_one_or_none()
    if not audit_session:
        raise APIError("Session not found or unauthorized", status_code=404)

    docs_result = await db.execute(select(Document).where(Document.session_id == session_id))
    documents = docs_result.scalars().all()

    comps_result = await db.execute(select(ComparisonResult).where(ComparisonResult.session_id == session_id))
    comparisons = comps_result.scalars().all()

    return FullSessionResponse(
        session=AuditSessionResponse.model_validate(audit_session),
        documents=[DocumentResponse.model_validate(d) for d in documents],
        comparisons=[ComparisonResultResponse.model_validate(c) for c in comparisons]
    )
