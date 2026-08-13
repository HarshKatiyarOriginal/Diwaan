from pydantic import BaseModel, Field
from typing import Optional, Literal, Any
from uuid import UUID

from .blueprint import Blueprint

class InterviewTurn(BaseModel):
    next_action: Literal["ask_question", "ready_to_generate"]
    question: Optional[str] = Field(default=None, description="Required if ask_question")
    extracted_facts: dict[str, Any] = Field(default_factory=dict, description="Incremental structured facts from the user's last answer")
    reasoning: Optional[str] = Field(default=None, description="Internal reasoning for logging only")

class StartInterviewResponse(BaseModel):
    session_id: UUID
    question: str

class RespondRequest(BaseModel):
    answer: str

class RespondResponse(BaseModel):
    session_id: UUID
    status: Literal["in_progress", "ready_to_generate", "complete"]
    question: Optional[str] = None
    blueprint: Optional[Blueprint] = None
