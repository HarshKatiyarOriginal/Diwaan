from pydantic import BaseModel, Field
from typing import Dict, Any, List, Literal, Optional
from datetime import datetime
from .component_registry import AllowedComponent

# Single source of truth for visual theme IDs, mirrored from
# frontend/src/themes/archetypes.js. Update both together.
VISUAL_THEME_IDS = (
    "kirana-shop",
    "farm",
    "paper-factory",
    "ice-cream-factory",
    "tiles-factory",
)

VisualTheme = Literal[
    "kirana-shop",
    "farm",
    "paper-factory",
    "ice-cream-factory",
    "tiles-factory",
]

# Safe archetype → default theme fallback (used when LLM omits visual_theme)
ARCHETYPE_THEME_FALLBACKS: Dict[str, str] = {
    "farmer": "farm",
    "shopkeeper": "kirana-shop",
    "factory_owner": "paper-factory",
}


class GridPosition(BaseModel):
    row: int
    col: int
    span_x: int = 1
    span_y: int = 1


class Widget(BaseModel):
    widget_id: str
    component_name: AllowedComponent
    title: str
    props: Dict[str, Any]
    grid_position: GridPosition


class Blueprint(BaseModel):
    archetype: Literal["farmer", "shopkeeper", "factory_owner"]
    # visual_theme is optional so existing DB rows and old fixtures don't break.
    # The LLM is instructed to always set it; the frontend falls back to
    # ARCHETYPE_THEME_FALLBACKS when it is None.
    visual_theme: Optional[VisualTheme] = None
    business_summary: str
    customized_parameters: Dict[str, Any] = Field(default_factory=dict)
    active_widgets: List[Widget] = Field(default_factory=list)
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0"


class OnboardingRequest(BaseModel):
    business_description: str


class ArchetypeClassification(BaseModel):
    archetype: Literal["farmer", "shopkeeper", "factory_owner"]
