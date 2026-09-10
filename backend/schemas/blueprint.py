from pydantic import BaseModel, Field, model_validator
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

VisualTheme = Literal[*VISUAL_THEME_IDS]

# Safe archetype → default theme fallback (used when LLM omits visual_theme)
ARCHETYPE_THEME_FALLBACKS: Dict[str, str] = {
    "farmer": "farm",
    "shopkeeper": "kirana-shop",
    "factory_owner": "paper-factory",
}

# ── Data Binding Layer ────────────────────────────────────────────────────────

# What kind of data this widget holds
DataKind = Literal["metric", "series", "table", "status", "list", "action"]

# What UI control the user interacts with to enter/update the value
DataInput = Literal["number", "text", "currency", "select", "date", "none"]


class DataBinding(BaseModel):
    """
    Describes how a widget is wired to real tenant data.
    key  — stable slug used as the storage key (never changes after generation)
    kind — shapes the storage and UI (metric=single float, series=time series, etc.)
    """
    key: str = Field(
        description="Stable, URL-safe slug e.g. 'monthly_revenue'. Never changes after generation."
    )
    kind: DataKind
    label: str = Field(description="Human-readable label for the edit UI, e.g. 'Monthly Revenue'")
    unit: Optional[str] = Field(
        default=None,
        description="Display unit, e.g. '₹', 'kg', 'units/hr'"
    )
    input: DataInput = Field(
        default="number",
        description="What kind of user-input control to show when editing"
    )
    options: List[str] = Field(
        default_factory=list,
        description="For kind=status or input=select: list of allowed string values"
    )
    columns: List[str] = Field(
        default_factory=list,
        description="For kind=table: ordered column header names"
    )
    help: Optional[str] = Field(
        default=None,
        description="Tooltip / help text shown next to the edit control"
    )


# Literal data keys that must NOT appear in Widget.props —
# all real data goes through DataBinding + the data API. props is
# presentation-only (chartType, layout, colour). Keys below carry
# fabricated *content*, so they are rejected on generation.
_FORBIDDEN_PROPS_KEYS = {
    "value", "rows", "items", "data", "chartData", "sparklineData",
    "values", "entries", "dataset", "series", "points", "segments",
    "status", "state", "isArmed", "armed",
    "text", "content", "message",
    "amount", "count", "total", "current",
}


def sanitize_stored_widgets(widgets: list) -> list:
    """
    Strip forbidden literal-data keys from *persisted* widget props so a
    dashboard saved before this validator existed (or by an older
    generator) can still be reconstructed into a Blueprint without
    tripping the generation-time guard. Read paths must use this.
    """
    cleaned = []
    for w in widgets or []:
        if not isinstance(w, dict):
            cleaned.append(w)
            continue
        w = dict(w)
        props = w.get("props")
        if isinstance(props, dict):
            w["props"] = {k: v for k, v in props.items() if k not in _FORBIDDEN_PROPS_KEYS}
        cleaned.append(w)
    return cleaned


class GridPosition(BaseModel):
    row: int
    col: int
    span_x: int = 1
    span_y: int = 1


class Widget(BaseModel):
    widget_id: str
    component_name: AllowedComponent
    title: str
    # props is PRESENTATION-ONLY: chart type, layout hints, colour overrides.
    # It must NOT contain literal data (values, rows, items).
    # Real data arrives at runtime from the /data API via DataBinding.
    props: Dict[str, Any] = Field(default_factory=dict)
    data_binding: Optional[DataBinding] = None
    grid_position: GridPosition

    @model_validator(mode="after")
    def reject_literal_data_in_props(self) -> "Widget":
        """
        Prevents the LLM from embedding fake/literal data values in props.
        Any widget that carries one of the forbidden keys triggers a retry.
        """
        bad = _FORBIDDEN_PROPS_KEYS.intersection(self.props.keys())
        if bad:
            raise ValueError(
                f"Widget '{self.widget_id}' ({self.component_name}) contains forbidden literal "
                f"data keys in props: {sorted(bad)}. "
                "All real data must be declared in data_binding and served from the /data API. "
                "Remove these keys from props."
            )
        return self


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
