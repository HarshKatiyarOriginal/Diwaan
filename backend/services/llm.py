import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from typing import Type, TypeVar, Any
from pydantic import BaseModel, ValidationError
import json
from ..core.config import settings
from ..core.exceptions import APIError
from ..core.logging import logger

# Initialize once
genai.configure(api_key=settings.GEMINI_API_KEY)
# We use flash tier per instructions
model = genai.GenerativeModel(settings.GEMINI_MODEL)

T = TypeVar('T', bound=BaseModel)

async def generate_structured_output(prompt: str, schema: Type[T], file_uri: str = None) -> T:
    """
    Generates structured JSON matching the Pydantic schema.
    Implements the "retry once on validation failure" rule.
    """
    config = GenerationConfig(
        response_mime_type="application/json",
    )
    
    contents = [prompt]
    uploaded_file = None
    if file_uri:
        import os
        import time
        if not os.path.exists(file_uri) or not os.path.isfile(file_uri):
            raise APIError(f"File not found or unreadable: {file_uri}", status_code=500)
        
        try:
            uploaded_file = genai.upload_file(path=file_uri)
            # Poll until ACTIVE
            while True:
                uploaded_file = genai.get_file(uploaded_file.name)
                state = getattr(uploaded_file.state, "name", str(uploaded_file.state))
                if state == "ACTIVE":
                    break
                elif state == "FAILED":
                    raise APIError("Gemini File API processing failed.", status_code=500)
                time.sleep(2)
                
            contents.append(uploaded_file)
        except Exception as e:
            raise APIError(f"Failed to upload or process file via Gemini API: {str(e)}", status_code=502)

    try:
        response = model.generate_content(contents, generation_config=config)
        return _validate_and_parse(response.text, schema)
    except ValidationError as e:
        logger.warning(f"LLM output validation failed. Retrying... Error: {e}")
        retry_prompt = f"{prompt}\n\nYour previous output failed validation with the following errors:\n{e}\nPlease correct the JSON output to strictly match the requested schema."
        retry_contents = [retry_prompt]
        if uploaded_file: 
            retry_contents.append(uploaded_file)
        
        response = model.generate_content(retry_contents, generation_config=config)
        try:
            return _validate_and_parse(response.text, schema)
        except ValidationError as e2:
            logger.error(f"LLM output validation failed twice. Raw output: {response.text}")
            raise APIError("LLM failed to produce valid structured output after retry.", status_code=502, details={"raw_output": response.text, "error": str(e2)})
    finally:
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
            except Exception:
                pass


def _validate_and_parse(text: str, schema: Type[T]) -> T:
    # Gemini sometimes wraps json in ```json ... ``` markdown blocks
    clean_text = text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    clean_text = clean_text.strip()
    
    data = json.loads(clean_text)
    return schema(**data)
