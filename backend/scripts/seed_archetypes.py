import asyncio
import os
import sys

# Add backend to path so we can import from core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db.session import AsyncSessionLocal
from backend.models.diwaan import Archetype

farmer_base = {
    "widgets": [
        {"widget_id": "w1", "component_name": "MetricCard", "title": "Crop Yield", "props": {"unit": "tons"}, "grid_position": {"row": 0, "col": 0}},
        {"widget_id": "w2", "component_name": "ChartWidget", "title": "Rainfall", "props": {"type": "bar"}, "grid_position": {"row": 0, "col": 1, "span_x": 2}}
    ]
}

shopkeeper_base = {
    "widgets": [
        {"widget_id": "w1", "component_name": "MetricCard", "title": "Daily Sales", "props": {"currency": "INR"}, "grid_position": {"row": 0, "col": 0}},
        {"widget_id": "w2", "component_name": "DataTable", "title": "Inventory", "props": {"columns": ["Item", "Stock"]}, "grid_position": {"row": 1, "col": 0, "span_x": 3}}
    ]
}

factory_base = {
    "widgets": [
        {"widget_id": "w1", "component_name": "MetricCard", "title": "Production Rate", "props": {"unit": "units/hr"}, "grid_position": {"row": 0, "col": 0}},
        {"widget_id": "w2", "component_name": "StatusBadge", "title": "Machine Status", "props": {"states": ["Running", "Idle", "Maintenance"]}, "grid_position": {"row": 0, "col": 1}}
    ]
}

async def seed_archetypes():
    async with AsyncSessionLocal() as db:
        archs = [
            Archetype(id="farmer", base_template=farmer_base),
            Archetype(id="shopkeeper", base_template=shopkeeper_base),
            Archetype(id="factory_owner", base_template=factory_base)
        ]
        db.add_all(archs)
        try:
            await db.commit()
            print("Archetypes seeded successfully.")
        except Exception as e:
            print(f"Error seeding archetypes (might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(seed_archetypes())
