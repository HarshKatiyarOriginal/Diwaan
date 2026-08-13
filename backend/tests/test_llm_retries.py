import pytest
from pydantic import BaseModel, ValidationError
from unittest.mock import patch, MagicMock
from backend.services.llm import generate_structured_output
from backend.core.exceptions import APIError

class MockSchema(BaseModel):
    name: str
    age: int

@pytest.mark.asyncio
async def test_llm_retry_success():
    with patch("backend.services.llm.model.generate_content") as mock_gen:
        # First call fails validation (returns bad json)
        mock_res_1 = MagicMock()
        mock_res_1.text = '{"name": "Alice", "age": "not an int"}'
        
        # Second call succeeds
        mock_res_2 = MagicMock()
        mock_res_2.text = '{"name": "Alice", "age": 30}'
        
        mock_gen.side_effect = [mock_res_1, mock_res_2]
        
        result = await generate_structured_output("Prompt", MockSchema)
        assert result.name == "Alice"
        assert result.age == 30
        assert mock_gen.call_count == 2

@pytest.mark.asyncio
async def test_llm_retry_failure():
    with patch("backend.services.llm.model.generate_content") as mock_gen:
        # Both calls fail
        mock_res_1 = MagicMock()
        mock_res_1.text = '{"name": "Alice"}' # missing age
        
        mock_res_2 = MagicMock()
        mock_res_2.text = '{"name": "Alice"}'
        
        mock_gen.side_effect = [mock_res_1, mock_res_2]
        
        with pytest.raises(APIError) as excinfo:
            await generate_structured_output("Prompt", MockSchema)
            
        assert excinfo.value.status_code == 502
        assert mock_gen.call_count == 2
