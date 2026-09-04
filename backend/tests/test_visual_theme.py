from backend.schemas.blueprint import Blueprint, VISUAL_THEME_IDS
from datetime import datetime


def test_visual_theme_schema_validation():
    # Test valid theme
    bp = Blueprint(
        archetype="factory_owner",
        visual_theme="tiles-factory",
        business_summary="Tile plant",
        generated_at=datetime.utcnow(),
    )
    assert bp.visual_theme == "tiles-factory"

    # Test None theme (optional)
    bp_none = Blueprint(
        archetype="farmer",
        business_summary="Farm",
        generated_at=datetime.utcnow(),
    )
    assert bp_none.visual_theme is None

    # Test VISUAL_THEME_IDS tuple contains expected 5 themes
    expected_themes = {
        "kirana-shop",
        "farm",
        "paper-factory",
        "ice-cream-factory",
        "tiles-factory",
    }
    assert set(VISUAL_THEME_IDS) == expected_themes
