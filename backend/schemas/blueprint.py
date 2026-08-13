from pydantic import BaseModel, Field
from typing import Dict, Any, List, Literal
from datetime import datetime
from .component_registry import AllowedComponent

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
    business_summary: str
    customized_parameters: Dict[str, Any] = Field(default_factory=dict)
    active_widgets: List[Widget] = Field(default_factory=list)
    generated_at: datetime
    version: str = "1.0"

class OnboardingRequest(BaseModel):
    business_description: str

class ArchetypeClassification(BaseModel):
    archetype: Literal["farmer", "shopkeeper", "factory_owner"]
