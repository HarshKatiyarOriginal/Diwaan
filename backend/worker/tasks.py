import asyncio
import uuid
from typing import Optional
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from .celery_app import celery_app
from ..db.session import AsyncSessionLocal
from ..models.specshield import Document, ComparisonResult
from ..schemas.specshield import DocumentSpecsExtracted, SpecParam
from ..services.llm import generate_structured_output
from ..core.storage import storage
from ..core.logging import logger

def async_to_sync(awaitable):
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # In a real environment, using a dedicated thread or nest_asyncio might be needed
        # depending on celery's async/sync pool handling.
        return asyncio.run_coroutine_threadsafe(awaitable, loop).result()
    return loop.run_until_complete(awaitable)

@celery_app.task(name="backend.worker.tasks.parse_document")
def parse_document(document_id: str, tenant_id: str):
    return async_to_sync(_parse_document_async(document_id, tenant_id))

async def _parse_document_async(document_id: str, tenant_id: str):
    doc_uuid = uuid.UUID(document_id) if isinstance(document_id, str) else document_id
    async with AsyncSessionLocal() as db:
        # 1. Fetch document
        result = await db.execute(select(Document).where(Document.id == doc_uuid))
        document = result.scalar_one_or_none()
        
        if not document:
            logger.error(f"Document {document_id} not found")
            return
            
        # 2. Get absolute path for Gemini upload (or bytes for API)
        abs_path = storage.get_absolute_path(document.storage_uri)
        
        # 3. Use Gemini structured output to extract {param, label, value}
        # In a production setup, we would upload the file to Gemini using `genai.upload_file`
        # and pass the file URI to the model. Since this is an architectural build and we 
        # lack a true file to upload in tests, we pass the local absolute path placeholder 
        # to the LLM service to simulate the multimodal call.
        prompt = f"""
        Analyze this {document.doc_type} document. Extract key technical specifications such as 
        VOLTAGE, COOLING_CAPACITY, REFRIGERANT, WEIGHT, STANDARD, MODEL.
        Return them precisely following the schema.
        """
        
        try:
            extraction = await generate_structured_output(
                prompt=prompt,
                schema=DocumentSpecsExtracted,
                file_uri=abs_path
            )
            
            document.specs = [spec.model_dump() for spec in extraction.specs]
            document.status = "processed"
            await db.commit()
            
            # Check if we should trigger comparison
            # e.g., if we now have both a blueprint and an invoice processed for this session
            await _trigger_comparison_if_ready(db, document.session_id)
            
        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            document.status = "error"
            await db.commit()
            raise e

async def _trigger_comparison_if_ready(db: AsyncSession, session_id):
    docs_res = await db.execute(select(Document).where(Document.session_id == session_id, Document.status == "processed"))
    docs = docs_res.scalars().all()
    
    blueprints = [d for d in docs if d.doc_type == "blueprint"]
    invoices = [d for d in docs if d.doc_type == "invoice"]
    
    if blueprints and invoices:
        bp = blueprints[0]
        inv = invoices[0]
        
        # Simple diff logic
        bp_dict = {s['param']: s['value'] for s in bp.specs}
        inv_dict = {s['param']: s['value'] for s in inv.specs}
        
        all_params = set(bp_dict.keys()).union(set(inv_dict.keys()))
        
        for param in all_params:
            bp_val = bp_dict.get(param)
            inv_val = inv_dict.get(param)
            is_match = bp_val == inv_val
            
            # Calculate severity
            severity = "LOW"
            if not is_match:
                if param in ["VOLTAGE", "COOLING_CAP", "REFRIGERANT"]:
                    severity = "HIGH"
                else:
                    severity = "MEDIUM"
                    
            comp = ComparisonResult(
                session_id=session_id,
                parameter=param,
                blueprint_value=bp_val,
                invoice_value=inv_val,
                is_match=is_match,
                severity=severity
            )
            db.add(comp)
            
        await db.commit()
