from pydantic import BaseModel, Field
from typing import Optional, Literal, Any, List
from uuid import UUID

from .blueprint import Blueprint, DataBinding


class InterviewTurn(BaseModel):
    """
    Structured output produced by the LLM at each interview turn.
    Coverage and catalog fields are merged into session state incrementally.
    """
    next_action: Literal["ask_question", "ready_to_generate"]
    question: Optional[str] = Field(
        default=None,
        description="The next question to ask the user. Required when next_action='ask_question'."
    )
    extracted_facts: dict[str, Any] = Field(
        default_factory=dict,
        description="Incremental structured facts extracted from the user's last answer. "
                    "Use snake_case keys. Values should be concrete (numbers, strings, booleans)."
    )
    # ── Coverage map ──────────────────────────────────────────────────────────
    coverage: dict[str, Literal["covered", "partial", "n/a", "uncovered"]] = Field(
        default_factory=dict,
        description=(
            "Coverage status for each business dimension after this turn. "
            "Only include dimensions whose status changed this turn. "
            "covered=concrete fact confirmed, partial=vague or incomplete, "
            "n/a=not applicable to this business (explain in coverage_notes), "
            "uncovered=still unknown."
        )
    )
    coverage_notes: dict[str, str] = Field(
        default_factory=dict,
        description="Free-text reason for any 'n/a' status — why this dimension doesn't apply."
    )
    # ── Binding catalog ───────────────────────────────────────────────────────
    catalog_additions: List[DataBinding] = Field(
        default_factory=list,
        description=(
            "New DataBinding entries discovered from this turn's answer. "
            "Each entry describes one real metric, table, or action that belongs "
            "on this business's dashboard. Accumulate — do not repeat already-added keys."
        )
    )
    reasoning: Optional[str] = Field(
        default=None,
        description="Internal chain-of-thought for logging only. Not shown to user."
    )


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
