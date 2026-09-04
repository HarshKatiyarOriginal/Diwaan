import pytest
import uuid
import os
from unittest.mock import patch, MagicMock
from backend.worker.tasks import _parse_document_async
from backend.models.specshield import Document
from backend.tests.conftest import TestingSessionLocal
from backend.schemas.specshield import DocumentSpecsExtracted, SpecParam
from backend.core.storage import storage
from sqlalchemy.future import select

@pytest.mark.asyncio
async def test_extraction_is_sensitive_to_file_content():
    # 1. Setup DB with two documents
    session_id = uuid.uuid4()
    tenant_id = str(uuid.uuid4())
    
    doc1_id = uuid.uuid4()
    doc2_id = uuid.uuid4()
    
    async with TestingSessionLocal() as db:
        doc1 = Document(id=doc1_id, session_id=session_id, doc_type="blueprint", filename="fake1.pdf", storage_uri="storage/fake1.pdf", status="pending")
        doc2 = Document(id=doc2_id, session_id=session_id, doc_type="invoice", filename="fake2.pdf", storage_uri="storage/fake2.pdf", status="pending")
        db.add_all([doc1, doc2])
        await db.commit()

    # 2. Mock storage to avoid actual file system reads if it's strictly db/SDK level test, 
    # but the task checks `os.path.exists`, so we'll create the physical dummy files.
    os.makedirs(os.path.abspath("storage"), exist_ok=True)
    path1 = os.path.abspath("storage/fake1.pdf")
    path2 = os.path.abspath("storage/fake2.pdf")
    with open(path1, "w") as f: f.write("Dummy PDF 1")
    with open(path2, "w") as f: f.write("Dummy PDF 2")

    # 3. Patch genai SDK calls
    with patch("backend.services.llm.genai.upload_file") as mock_upload, \
         patch("backend.services.llm.genai.get_file") as mock_get, \
         patch("backend.services.llm.genai.delete_file") as mock_delete, \
         patch("backend.services.llm.model.generate_content") as mock_generate:
        
        # Setup mock file upload returns
        mock_file_1 = MagicMock()
        mock_file_1.name = "files/mock1"
        mock_file_1.state.name = "ACTIVE"
        
        mock_file_2 = MagicMock()
        mock_file_2.name = "files/mock2"
        mock_file_2.state.name = "ACTIVE"
        
        mock_upload.side_effect = [mock_file_1, mock_file_2]
        mock_get.side_effect = [mock_file_1, mock_file_2]
        
        # Setup mock generation returns depending on the file object passed in `contents`
        def side_effect_generate(contents, **kwargs):
            # contents[1] is the uploaded_file object appended to the prompt
            uploaded_file = contents[1]
            if uploaded_file.name == "files/mock1":
                mock_response = MagicMock()
                mock_response.text = '{"specs": [{"param": "VOLTAGE", "label": "Voltage", "value": "480V"}]}'
                return mock_response
            elif uploaded_file.name == "files/mock2":
                mock_response = MagicMock()
                mock_response.text = '{"specs": [{"param": "VOLTAGE", "label": "Voltage", "value": "240V"}]}'
                return mock_response
            raise ValueError("Unexpected file object")

        mock_generate.side_effect = side_effect_generate
        
        # Run the celery async task internals
        await _parse_document_async(str(doc1_id), tenant_id)
        await _parse_document_async(str(doc2_id), tenant_id)
        
        # 4. Assert actual DB changes reflect the distinct mock outputs
        async with TestingSessionLocal() as db:
            result1 = await db.execute(select(Document).where(Document.id == doc1_id))
            processed_doc1 = result1.scalar_one()
            assert processed_doc1.status == "processed"
            assert processed_doc1.specs[0]["value"] == "480V"
            
            result2 = await db.execute(select(Document).where(Document.id == doc2_id))
            processed_doc2 = result2.scalar_one()
            assert processed_doc2.status == "processed"
            assert processed_doc2.specs[0]["value"] == "240V"

    # Cleanup
    os.remove(path1)
    os.remove(path2)
