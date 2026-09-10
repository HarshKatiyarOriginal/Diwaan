import google.generativeai as genai
from google.generativeai.types import GenerationConfig
from typing import Type, TypeVar, Any
from pydantic import BaseModel, ValidationError
import json
from ..core.config import settings
from ..core.exceptions import APIError
from ..core.logging import logger

try:
    from google.api_core import exceptions as _gcp_exc
except Exception:  # pragma: no cover
    _gcp_exc = None

# Initialize once
genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel(settings.GEMINI_MODEL)

T = TypeVar('T', bound=BaseModel)


def _is_model_not_found(e: Exception) -> bool:
    """
    True only when the SDK raised a genuine 'model not found' error.
    Never inspects the model's OWN output text — a business answer or a
    blueprint value containing '404' must not be mistaken for this.
    """
    if _gcp_exc is not None and isinstance(e, _gcp_exc.NotFound):
        return True
    s = str(e).lower()
    return "models/" in s and ("not found" in s or "is not supported" in s)


async def generate_structured_output(prompt: str, schema: Type[T], file_uri: str = None) -> T:
    """
    Generates structured JSON matching the Pydantic schema.
    Implements the 'retry once on validation failure' rule.
    Surfaces model-not-found errors clearly rather than silently producing
    a ValidationError from Gemini's HTML error body.
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
        except APIError:
            raise
        except Exception as e:
            raise APIError(f"Failed to upload or process file via Gemini API: {str(e)}", status_code=502)

    try:
        response = model.generate_content(contents, generation_config=config)
        return _validate_and_parse(response.text, schema)
    except APIError:
        raise
    except ValidationError as e:
        logger.warning(f"LLM output validation failed. Retrying... Error: {e}")
        retry_prompt = (
            f"{prompt}\n\nYour previous output failed validation with the following errors:\n{e}\n"
            "Please correct the JSON output to strictly match the requested schema."
        )
        retry_contents = [retry_prompt]
        if uploaded_file:
            retry_contents.append(uploaded_file)

        try:
            response = model.generate_content(retry_contents, generation_config=config)
            return _validate_and_parse(response.text, schema)
        except ValidationError as e2:
            logger.error(f"LLM output validation failed twice. Raw output: {response.text}")
            raise APIError(
                "LLM failed to produce valid structured output after retry.",
                status_code=502,
                details={"raw_output": response.text, "error": str(e2)},
            )
    except Exception as e:
        # HTTP-level errors from the Gemini SDK
        if _is_model_not_found(e):
            raise APIError(
                f"Gemini model '{settings.GEMINI_MODEL}' was not found or is not available "
                "for this API key. Update GEMINI_MODEL in backend/.env.",
                status_code=502,
            )
        raise APIError(f"Gemini API error: {e}", status_code=502)
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
