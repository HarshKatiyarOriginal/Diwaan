import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db.session import AsyncSessionLocal
from backend.models.diwaan import Archetype
import backend.models.user
import backend.models.specshield
from sqlalchemy.future import select

# ─── FARMER ────────────────────────────────────────────────────────────────────
# Matches frontend "farm" theme. Covers: crop cycle, irrigation, input costs,
# harvest yield, mandi prices, farm activity log.
farmer_base = {
    "widgets": [
        {
            "widget_id": "w-farm-1",
            "component_name": "MetricCard",
            "title": "Active Cultivation Area",
            "props": {
                "value": "{{acres_under_cultivation}}",
                "unit": "Acres",
                "delta": "{{fallow_change}}",
                "sparklineData": []
            },
            "grid_position": {"row": 1, "col": 1, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-farm-2",
            "component_name": "StatusBadge",
            "title": "Irrigation System",
            "props": {
                "status": "ok",
                "label": "Pump Active — Flow Normal"
            },
            "grid_position": {"row": 1, "col": 2, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-farm-3",
            "component_name": "DataTable",
            "title": "Crop Rotation Status",
            "props": {
                "columns": ["Crop", "Parcel", "Growth Stage", "Expected Harvest"],
                "rows": [
                    ["Wheat", "Parcel A", "Vegetative", "April 15"],
                    ["Mustard", "Parcel B", "Flowering", "March 20"],
                    ["Sugarcane", "Parcel C", "Harvesting", "Current"]
                ]
            },
            "grid_position": {"row": 2, "col": 1, "span_x": 2, "span_y": 1}
        },
        {
            "widget_id": "w-farm-4",
            "component_name": "ChartWidget",
            "title": "Seasonal Yield Trend (Quintal)",
            "props": {
                "chartType": "donut",
                "data": [
                    {"label": "Kharif", "val": 40},
                    {"label": "Rabi", "val": 35},
                    {"label": "Zaid", "val": 25}
                ]
            },
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-farm-5",
            "component_name": "ListWidget",
            "title": "Recent Farm Activity",
            "props": {
                "items": [
                    {"icon": "🚜", "text": "Tractor serviced", "meta": "Completed", "dotColor": "var(--status-ok)"},
                    {"icon": "💧", "text": "Urea application (Parcel B)", "meta": "Today", "dotColor": "var(--status-ok)"},
                    {"icon": "📈", "text": "Mandi price update (Wheat)", "meta": "₹2,275/Q", "dotColor": "var(--status-warning)"}
                ]
            },
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-farm-6",
            "component_name": "LedgerToggle",
            "title": "Season Ledger",
            "props": {"label": "Close Season Accounts", "isArmed": False},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1}
        }
    ]
}

# ─── SHOPKEEPER ─────────────────────────────────────────────────────────────────
# Matches frontend "kirana-shop" theme. Covers: daily POS revenue, low-stock
# inventory, sales by category, recent transactions, compliance status, EOD ledger.
shopkeeper_base = {
    "widgets": [
        {
            "widget_id": "w-sk-1",
            "component_name": "MetricCard",
            "title": "Today's Revenue",
            "props": {
                "value": "₹{{daily_revenue}}",
                "unit": "",
                "delta": "{{revenue_delta}}",
                "sparklineData": []
            },
            "grid_position": {"row": 1, "col": 1, "span_x": 2, "span_y": 1}
        },
        {
            "widget_id": "w-sk-2",
            "component_name": "StatusBadge",
            "title": "Tax & Compliance",
            "props": {
                "status": "pending",
                "label": "GST Filing Due in 3 Days"
            },
            "grid_position": {"row": 1, "col": 3, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-sk-3",
            "component_name": "DataTable",
            "title": "Inventory — Low Stock Alert",
            "props": {
                "columns": ["SKU / Category", "Stock Level", "Reorder Threshold", "Status"],
                "rows": [
                    ["Staples (Rice/Dal)", "450 kg", "200 kg", "OK"],
                    ["Packaged Goods", "120 units", "50 units", "OK"],
                    ["Dairy / Perishables", "15 units", "20 units", "REORDER"]
                ]
            },
            "grid_position": {"row": 2, "col": 1, "span_x": 3, "span_y": 1}
        },
        {
            "widget_id": "w-sk-4",
            "component_name": "ChartWidget",
            "title": "Sales by Category",
            "props": {
                "chartType": "donut",
                "data": [
                    {"label": "Staples", "val": 50},
                    {"label": "Snacks / FMCG", "val": 30},
                    {"label": "Dairy", "val": 20}
                ]
            },
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-sk-5",
            "component_name": "ListWidget",
            "title": "Recent Transactions",
            "props": {
                "items": [
                    {"icon": "🛍️", "text": "Customer #1042", "meta": "₹450", "dotColor": "var(--status-ok)"},
                    {"icon": "🛒", "text": "Supplier Payment — Amul", "meta": "-₹12,000", "dotColor": "var(--status-warning)"},
                    {"icon": "🛍️", "text": "Customer #1043", "meta": "₹1,200", "dotColor": "var(--status-ok)"}
                ]
            },
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-sk-6",
            "component_name": "LedgerToggle",
            "title": "End-of-Day Ledger",
            "props": {"label": "Finalize Daily Accounts", "isArmed": False},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1}
        }
    ]
}

# ─── FACTORY OWNER ───────────────────────────────────────────────────────────────
# Matches frontend "paper-factory" default theme (may be overridden to
# ice-cream-factory or tiles-factory by visual_theme). Covers: production rate,
# machine uptime, supply chain stock, assembly status, shift log, batch ledger.
factory_base = {
    "widgets": [
        {
            "widget_id": "w-fo-1",
            "component_name": "MetricCard",
            "title": "Production Rate",
            "props": {
                "value": "{{production_rate}}",
                "unit": "units/hr",
                "delta": "{{production_delta}}",
                "sparklineData": []
            },
            "grid_position": {"row": 1, "col": 1, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-fo-2",
            "component_name": "StatusBadge",
            "title": "Assembly Line Status",
            "props": {
                "status": "ok",
                "label": "Line 1 Running — No Faults"
            },
            "grid_position": {"row": 1, "col": 2, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-fo-3",
            "component_name": "DataTable",
            "title": "Raw Material Supply Chain",
            "props": {
                "columns": ["Material", "Stock Level", "Supplier", "Status"],
                "rows": [
                    ["Primary Input", "78%", "Vendor A", "OK"],
                    ["Secondary Input", "55%", "Vendor B", "OK"],
                    ["Consumable", "12%", "Vendor C", "CRITICAL"]
                ]
            },
            "grid_position": {"row": 2, "col": 1, "span_x": 2, "span_y": 1}
        },
        {
            "widget_id": "w-fo-4",
            "component_name": "ChartWidget",
            "title": "Machine Uptime Distribution",
            "props": {
                "chartType": "donut",
                "data": [
                    {"label": "Running", "val": 85},
                    {"label": "Idle", "val": 10},
                    {"label": "Maintenance", "val": 5}
                ]
            },
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-fo-5",
            "component_name": "ListWidget",
            "title": "Shift Activity Log",
            "props": {
                "items": [
                    {"icon": "⚙️", "text": "Line 2 maintenance completed", "meta": "08:30 AM", "dotColor": "var(--status-ok)"},
                    {"icon": "📦", "text": "Batch #401 dispatched", "meta": "10:15 AM", "dotColor": "var(--status-ok)"},
                    {"icon": "⚠️", "text": "Consumable stock below threshold", "meta": "Critical", "dotColor": "var(--status-critical)"}
                ]
            },
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1}
        },
        {
            "widget_id": "w-fo-6",
            "component_name": "LedgerToggle",
            "title": "Shift Ledger",
            "props": {"label": "Finalize Shift Batch", "isArmed": False},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1}
        }
    ]
}


from backend.db.session import AsyncSessionLocal, Base, engine

async def seed_archetypes():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        updates = [
            ("farmer", farmer_base),
            ("shopkeeper", shopkeeper_base),
            ("factory_owner", factory_base),
        ]
        for arch_id, template in updates:
            result = await db.execute(select(Archetype).where(Archetype.id == arch_id))
            existing = result.scalar_one_or_none()
            if existing:
                existing.base_template = template
                print(f"Updated archetype: {arch_id}")
            else:
                db.add(Archetype(id=arch_id, base_template=template))
                print(f"Inserted archetype: {arch_id}")
        try:
            await db.commit()
            print("Archetypes seeded/updated successfully.")
        except Exception as e:
            await db.rollback()
            print(f"Error seeding archetypes: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(seed_archetypes())
