"""
seed_archetypes.py — Archetype base templates (binding catalog format).

Templates are PRESENTATION-ONLY: they define widget layout, grid positions,
component types, and DataBinding keys. No literal data values.
Real data is entered by the tenant via the dashboard data API.

Run with:
    $env:PYTHONPATH="c:\\Users\\Lenovo\\OneDrive\\Desktop\\Diwaan"
    python -m backend.scripts.seed_archetypes
"""
import asyncio
import os
import sys

import backend.models
from backend.models import Base, Archetype
from backend.db.session import AsyncSessionLocal, engine
from sqlalchemy.future import select


# ─── FARMER ────────────────────────────────────────────────────────────────────
# Binding catalog for agriculture businesses.
# Covers: crop cycle, irrigation, input costs, harvest yield, mandi prices.
farmer_base = {
    "binding_catalog": [
        {"key": "acres_under_cultivation", "kind": "metric", "label": "Cultivation Area", "unit": "Acres", "input": "number"},
        {"key": "irrigation_status",       "kind": "status", "label": "Irrigation System", "input": "select",
         "options": ["Pump Active", "Drip Running", "Offline", "Maintenance"]},
        {"key": "crop_rotation_table",     "kind": "table",  "label": "Crop Rotation Status", "input": "none",
         "columns": ["Crop", "Parcel", "Growth Stage", "Expected Harvest"]},
        {"key": "seasonal_yield_series",   "kind": "series", "label": "Seasonal Yield (Quintal)", "unit": "Q", "input": "number"},
        {"key": "farm_activity_log",       "kind": "list",   "label": "Recent Farm Activity", "input": "text"},
        {"key": "season_ledger",           "kind": "action", "label": "Close Season Accounts", "input": "none"},
        {"key": "input_cost_per_season",   "kind": "metric", "label": "Input Cost This Season", "unit": "₹", "input": "currency"},
        {"key": "mandi_price_wheat",       "kind": "metric", "label": "Mandi Price (Wheat)", "unit": "₹/Q", "input": "currency"},
    ],
    "widgets": [
        {
            "widget_id": "w-farm-1",
            "component_name": "MetricCard",
            "title": "Active Cultivation Area",
            "props": {"unit": "Acres"},
            "data_binding": {"key": "acres_under_cultivation", "kind": "metric", "label": "Cultivation Area", "unit": "Acres", "input": "number"},
            "grid_position": {"row": 1, "col": 1, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-farm-2",
            "component_name": "StatusBadge",
            "title": "Irrigation System",
            "props": {},
            "data_binding": {"key": "irrigation_status", "kind": "status", "label": "Irrigation System", "input": "select",
                             "options": ["Pump Active", "Drip Running", "Offline", "Maintenance"]},
            "grid_position": {"row": 1, "col": 2, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-farm-3",
            "component_name": "DataTable",
            "title": "Crop Rotation Status",
            "props": {},
            "data_binding": {"key": "crop_rotation_table", "kind": "table", "label": "Crop Rotation Status",
                             "columns": ["Crop", "Parcel", "Growth Stage", "Expected Harvest"], "input": "none"},
            "grid_position": {"row": 2, "col": 1, "span_x": 2, "span_y": 1},
        },
        {
            "widget_id": "w-farm-4",
            "component_name": "ChartWidget",
            "title": "Seasonal Yield Trend (Quintal)",
            "props": {"chartType": "line"},
            "data_binding": {"key": "seasonal_yield_series", "kind": "series", "label": "Seasonal Yield", "unit": "Q", "input": "number"},
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-farm-5",
            "component_name": "ListWidget",
            "title": "Recent Farm Activity",
            "props": {},
            "data_binding": {"key": "farm_activity_log", "kind": "list", "label": "Farm Activity", "input": "text"},
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-farm-6",
            "component_name": "LedgerToggle",
            "title": "Season Ledger",
            "props": {"label": "Close Season Accounts"},
            "data_binding": {"key": "season_ledger", "kind": "action", "label": "Close Season Accounts", "input": "none"},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1},
        },
    ],
}

# ─── SHOPKEEPER ─────────────────────────────────────────────────────────────────
# Binding catalog for retail / kirana businesses.
# Covers: daily revenue, inventory, sales by category, transactions, compliance.
shopkeeper_base = {
    "binding_catalog": [
        {"key": "daily_revenue",        "kind": "metric", "label": "Today's Revenue", "unit": "₹", "input": "currency"},
        {"key": "revenue_series",       "kind": "series", "label": "Revenue Trend", "unit": "₹", "input": "currency"},
        {"key": "compliance_status",    "kind": "status", "label": "Tax & Compliance", "input": "select",
         "options": ["OK", "GST Due", "FSSAI Expiry", "Pending"]},
        {"key": "inventory_table",      "kind": "table",  "label": "Inventory — Low Stock", "input": "none",
         "columns": ["SKU / Category", "Stock Level", "Reorder Threshold", "Status"]},
        {"key": "sales_by_category",    "kind": "series", "label": "Sales by Category", "input": "number"},
        {"key": "transaction_log",      "kind": "list",   "label": "Recent Transactions", "input": "text"},
        {"key": "eod_ledger",           "kind": "action", "label": "Finalize Daily Accounts", "input": "none"},
        {"key": "monthly_revenue",      "kind": "metric", "label": "This Month Revenue", "unit": "₹", "input": "currency"},
    ],
    "widgets": [
        {
            "widget_id": "w-sk-1",
            "component_name": "MetricCard",
            "title": "Today's Revenue",
            "props": {"unit": "₹"},
            "data_binding": {"key": "daily_revenue", "kind": "metric", "label": "Today's Revenue", "unit": "₹", "input": "currency"},
            "grid_position": {"row": 1, "col": 1, "span_x": 2, "span_y": 1},
        },
        {
            "widget_id": "w-sk-2",
            "component_name": "StatusBadge",
            "title": "Tax & Compliance",
            "props": {},
            "data_binding": {"key": "compliance_status", "kind": "status", "label": "Tax & Compliance", "input": "select",
                             "options": ["OK", "GST Due", "FSSAI Expiry", "Pending"]},
            "grid_position": {"row": 1, "col": 3, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-sk-3",
            "component_name": "DataTable",
            "title": "Inventory — Low Stock Alert",
            "props": {},
            "data_binding": {"key": "inventory_table", "kind": "table", "label": "Inventory — Low Stock",
                             "columns": ["SKU / Category", "Stock Level", "Reorder Threshold", "Status"], "input": "none"},
            "grid_position": {"row": 2, "col": 1, "span_x": 3, "span_y": 1},
        },
        {
            "widget_id": "w-sk-4",
            "component_name": "ChartWidget",
            "title": "Sales by Category",
            "props": {"chartType": "donut"},
            "data_binding": {"key": "sales_by_category", "kind": "series", "label": "Sales by Category", "input": "number"},
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-sk-5",
            "component_name": "ListWidget",
            "title": "Recent Transactions",
            "props": {},
            "data_binding": {"key": "transaction_log", "kind": "list", "label": "Recent Transactions", "input": "text"},
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-sk-6",
            "component_name": "LedgerToggle",
            "title": "End-of-Day Ledger",
            "props": {"label": "Finalize Daily Accounts"},
            "data_binding": {"key": "eod_ledger", "kind": "action", "label": "Finalize Daily Accounts", "input": "none"},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1},
        },
    ],
}

# ─── FACTORY OWNER ───────────────────────────────────────────────────────────────
# Binding catalog for manufacturing businesses.
# Covers: production rate, machine uptime, supply chain, shift log, batch ledger.
factory_base = {
    "binding_catalog": [
        {"key": "production_rate",       "kind": "metric", "label": "Production Rate", "unit": "units/hr", "input": "number"},
        {"key": "production_series",     "kind": "series", "label": "Production History", "unit": "units/hr", "input": "number"},
        {"key": "line_status",           "kind": "status", "label": "Assembly Line Status", "input": "select",
         "options": ["Running", "Idle", "Maintenance", "Fault"]},
        {"key": "supply_chain_table",    "kind": "table",  "label": "Raw Material Supply Chain", "input": "none",
         "columns": ["Material", "Stock Level", "Supplier", "Status"]},
        {"key": "machine_uptime_series", "kind": "series", "label": "Machine Uptime", "unit": "%", "input": "number"},
        {"key": "shift_activity_log",    "kind": "list",   "label": "Shift Activity Log", "input": "text"},
        {"key": "shift_ledger",          "kind": "action", "label": "Finalize Shift Batch", "input": "none"},
        {"key": "defect_rate",           "kind": "metric", "label": "Defect Rate", "unit": "%", "input": "number"},
    ],
    "widgets": [
        {
            "widget_id": "w-fo-1",
            "component_name": "MetricCard",
            "title": "Production Rate",
            "props": {"unit": "units/hr"},
            "data_binding": {"key": "production_rate", "kind": "metric", "label": "Production Rate", "unit": "units/hr", "input": "number"},
            "grid_position": {"row": 1, "col": 1, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-fo-2",
            "component_name": "StatusBadge",
            "title": "Assembly Line Status",
            "props": {},
            "data_binding": {"key": "line_status", "kind": "status", "label": "Assembly Line Status", "input": "select",
                             "options": ["Running", "Idle", "Maintenance", "Fault"]},
            "grid_position": {"row": 1, "col": 2, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-fo-3",
            "component_name": "DataTable",
            "title": "Raw Material Supply Chain",
            "props": {},
            "data_binding": {"key": "supply_chain_table", "kind": "table", "label": "Raw Material Supply Chain",
                             "columns": ["Material", "Stock Level", "Supplier", "Status"], "input": "none"},
            "grid_position": {"row": 2, "col": 1, "span_x": 2, "span_y": 1},
        },
        {
            "widget_id": "w-fo-4",
            "component_name": "ChartWidget",
            "title": "Machine Uptime Distribution",
            "props": {"chartType": "donut"},
            "data_binding": {"key": "machine_uptime_series", "kind": "series", "label": "Machine Uptime", "unit": "%", "input": "number"},
            "grid_position": {"row": 3, "col": 1, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-fo-5",
            "component_name": "ListWidget",
            "title": "Shift Activity Log",
            "props": {},
            "data_binding": {"key": "shift_activity_log", "kind": "list", "label": "Shift Activity Log", "input": "text"},
            "grid_position": {"row": 3, "col": 2, "span_x": 1, "span_y": 1},
        },
        {
            "widget_id": "w-fo-6",
            "component_name": "LedgerToggle",
            "title": "Shift Ledger",
            "props": {"label": "Finalize Shift Batch"},
            "data_binding": {"key": "shift_ledger", "kind": "action", "label": "Finalize Shift Batch", "input": "none"},
            "grid_position": {"row": 4, "col": 1, "span_x": 2, "span_y": 1},
        },
    ],
}


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
