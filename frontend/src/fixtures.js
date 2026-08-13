// frontend/src/fixtures.js

export const FACTORY_OWNER_BLUEPRINT = {
    archetype: "factory_owner",
    business_summary: "A medium-scale cycle manufacturing unit in Kanpur focusing on daily assembly and supply chain health.",
    customized_parameters: {
        target_daily_units: 1500,
        currency: "INR"
    },
    active_widgets: [
        {
            widget_id: "w-fo-1",
            component_name: "MetricCard",
            title: "Daily Production",
            grid_position: { row: 1, col: 1, span_x: 1, span_y: 1 },
            props: { value: "1,240", unit: "Units", delta: "+8.4%", sparklineData: [1000, 1100, 1050, 1150, 1200, 1240] }
        },
        {
            widget_id: "w-fo-2",
            component_name: "StatusBadge",
            title: "Assembly Line Status",
            grid_position: { row: 1, col: 2, span_x: 1, span_y: 1 },
            props: { status: "ok", label: "Running smoothly" }
        },
        {
            widget_id: "w-fo-3",
            component_name: "DataTable",
            title: "Supply Chain Stock",
            grid_position: { row: 2, col: 1, span_x: 2, span_y: 1 },
            props: {
                columns: ["Material", "Stock Level", "Status"],
                rows: [
                    ["Tyre Stock", "78%", "OK"],
                    ["Frame Steel", "55%", "OK"],
                    ["Brakes", "12%", "CRITICAL"]
                ]
            }
        },
        {
            widget_id: "w-fo-4",
            component_name: "LedgerToggle",
            title: "Ledger Control",
            grid_position: { row: 3, col: 1, span_x: 2, span_y: 1 },
            props: { label: "Finalize Daily Ledger", isArmed: false }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const SHOPKEEPER_BLUEPRINT = {
    archetype: "shopkeeper",
    business_summary: "A high-traffic retail electronics store needing real-time sales and inventory tracking.",
    customized_parameters: {
        currency: "INR"
    },
    active_widgets: [
        {
            widget_id: "w-sk-1",
            component_name: "MetricCard",
            title: "Today's Revenue",
            grid_position: { row: 1, col: 1, span_x: 2, span_y: 1 },
            props: { value: "₹48,200", unit: "", delta: "-2.1%", sparklineData: [] }
        },
        {
            widget_id: "w-sk-2",
            component_name: "ChartWidget",
            title: "Sales by Category",
            grid_position: { row: 2, col: 1, span_x: 1, span_y: 2 },
            props: { chartType: "donut", data: [{label: "Phones", val: 60}, {label: "Laptops", val: 30}, {label: "Accessories", val: 10}] }
        },
        {
            widget_id: "w-sk-3",
            component_name: "ListWidget",
            title: "Recent Transactions",
            grid_position: { row: 2, col: 2, span_x: 1, span_y: 2 },
            props: {
                items: [
                    { icon: "📱", text: "iPhone 15 Pro", meta: "₹1,20,000", dotColor: "var(--status-ok)" },
                    { icon: "🎧", text: "AirPods Max", meta: "₹59,900", dotColor: "var(--status-ok)" },
                    { icon: "💻", text: "Refund - MacBook", meta: "-₹1,50,000", dotColor: "var(--status-critical)" }
                ]
            }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const MALFORMED_BLUEPRINT = {
    archetype: "farmer",
    business_summary: "Testing the fallback mechanism.",
    customized_parameters: {},
    active_widgets: [
        {
            widget_id: "w-err-1",
            component_name: "QuantumWidget",
            title: "Future Tech",
            grid_position: { row: 1, col: 1, span_x: 1, span_y: 1 },
            props: { warpSpeed: 9 }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const KIRANA_SHOP_BLUEPRINT = {
    archetype: "shopkeeper",
    business_summary: "A local kirana store managing daily staples, perishable goods, and fast-moving consumer goods (FMCG).",
    customized_parameters: { currency: "INR" },
    active_widgets: [
        {
            widget_id: "w-ks-1",
            component_name: "MetricCard",
            title: "Daily Sales",
            grid_position: { row: 1, col: 1, span_x: 1, span_y: 1 },
            props: { value: "₹18,500", unit: "", delta: "+4.2%", sparklineData: [15000, 16200, 15800, 17000, 17500, 18500] }
        },
        {
            widget_id: "w-ks-2",
            component_name: "StatusBadge",
            title: "Tax & Compliance",
            grid_position: { row: 1, col: 2, span_x: 1, span_y: 1 },
            props: { status: "pending", label: "GST Filing Due in 3 Days" }
        },
        {
            widget_id: "w-ks-3",
            component_name: "DataTable",
            title: "Stock Levels",
            grid_position: { row: 2, col: 1, span_x: 2, span_y: 1 },
            props: {
                columns: ["Category", "Current Stock", "Status"],
                rows: [
                    ["Staples (Rice/Dal)", "450 kg", "OK"],
                    ["Packaged Goods", "120 units", "OK"],
                    ["Dairy/Perishables", "15 units", "REORDER"]
                ]
            }
        },
        {
            widget_id: "w-ks-4",
            component_name: "ChartWidget",
            title: "Sales by Category",
            grid_position: { row: 3, col: 1, span_x: 1, span_y: 1 },
            props: { chartType: "donut", data: [{label: "Staples", val: 50}, {label: "Snacks", val: 30}, {label: "Dairy", val: 20}] }
        },
        {
            widget_id: "w-ks-5",
            component_name: "ListWidget",
            title: "Recent Transactions",
            grid_position: { row: 3, col: 2, span_x: 1, span_y: 1 },
            props: {
                items: [
                    { icon: "🛍️", text: "Customer #1042", meta: "₹450", dotColor: "var(--status-ok)" },
                    { icon: "🛒", text: "Supplier Payment", meta: "-₹12,000", dotColor: "var(--status-pending)" },
                    { icon: "🛍️", text: "Customer #1043", meta: "₹1,200", dotColor: "var(--status-ok)" }
                ]
            }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const FARM_BLUEPRINT = {
    archetype: "farmer",
    business_summary: "A 40-acre agricultural farm managing crop rotation, water usage, and harvest yields.",
    customized_parameters: { currency: "INR" },
    active_widgets: [
        {
            widget_id: "w-fm-1",
            component_name: "MetricCard",
            title: "Active Cultivation",
            grid_position: { row: 1, col: 1, span_x: 1, span_y: 1 },
            props: { value: "32", unit: "Acres", delta: "-8 Acres (fallow)", sparklineData: [] }
        },
        {
            widget_id: "w-fm-2",
            component_name: "StatusBadge",
            title: "Irrigation System",
            grid_position: { row: 1, col: 2, span_x: 1, span_y: 1 },
            props: { status: "ok", label: "Pumps Active — Flow Normal" }
        },
        {
            widget_id: "w-fm-3",
            component_name: "DataTable",
            title: "Crop Rotation Status",
            grid_position: { row: 2, col: 1, span_x: 2, span_y: 1 },
            props: {
                columns: ["Crop", "Stage", "Expected Harvest"],
                rows: [
                    ["Wheat (Parcel A)", "Vegetative", "April 15"],
                    ["Mustard (Parcel B)", "Flowering", "March 20"],
                    ["Sugarcane (Parcel C)", "Harvesting", "Current"]
                ]
            }
        },
        {
            widget_id: "w-fm-4",
            component_name: "ChartWidget",
            title: "Seasonal Yield Trend",
            grid_position: { row: 3, col: 1, span_x: 1, span_y: 1 },
            props: { chartType: "donut", data: [{label: "Q1", val: 40}, {label: "Q2", val: 20}, {label: "Q3", val: 60}] } // Using donut as placeholder for trend since it's what we have
        },
        {
            widget_id: "w-fm-5",
            component_name: "ListWidget",
            title: "Recent Farm Activity",
            grid_position: { row: 3, col: 2, span_x: 1, span_y: 1 },
            props: {
                items: [
                    { icon: "🚜", text: "Tractor Maintenance", meta: "Completed", dotColor: "var(--status-ok)" },
                    { icon: "💧", text: "Urea Application (Parcel B)", meta: "Today", dotColor: "var(--status-ok)" },
                    { icon: "📈", text: "Mandi Price Update (Wheat)", meta: "₹2,275/Q", dotColor: "var(--status-pending)" }
                ]
            }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const PAPER_FACTORY_BLUEPRINT = {
    archetype: "factory_owner",
    business_summary: "An industrial paper and pulp mill requiring strict chemical handling and continuous process monitoring.",
    customized_parameters: { currency: "INR" },
    active_widgets: [
        {
            widget_id: "w-pf-1",
            component_name: "MetricCard",
            title: "Daily Output",
            grid_position: { row: 1, col: 1, span_x: 1, span_y: 1 },
            props: { value: "142", unit: "Tonnes", delta: "+2.1%", sparklineData: [130, 135, 140, 138, 141, 142] }
        },
        {
            widget_id: "w-pf-2",
            component_name: "StatusBadge",
            title: "Effluent Treatment",
            grid_position: { row: 1, col: 2, span_x: 1, span_y: 1 },
            props: { status: "ok", label: "Ph Levels Compliant (7.2)" }
        },
        {
            widget_id: "w-pf-3",
            component_name: "DataTable",
            title: "Raw Material Stock",
            grid_position: { row: 2, col: 1, span_x: 2, span_y: 1 },
            props: {
                columns: ["Material", "Inventory", "Status"],
                rows: [
                    ["Recycled Fiber", "450 Tonnes", "OK"],
                    ["Wood Pulp", "120 Tonnes", "OK"],
                    ["Bleaching Agents", "15 Barrels", "REORDER"]
                ]
            }
        },
        {
            widget_id: "w-pf-4",
            component_name: "ChartWidget",
            title: "Machine Uptime",
            grid_position: { row: 3, col: 1, span_x: 1, span_y: 1 },
            props: { chartType: "donut", data: [{label: "Paper Machine 1", val: 98}, {label: "Pulp Digester", val: 95}, {label: "Downtime", val: 2}] }
        },
        {
            widget_id: "w-pf-5",
            component_name: "LedgerToggle",
            title: "Production Ledger",
            grid_position: { row: 3, col: 2, span_x: 1, span_y: 1 },
            props: { label: "Finalize Shift Batch", isArmed: false }
        }
    ],
    generated_at: new Date().toISOString(),
    version: "1.0"
};

export const SPEC_SHIELD_FIXTURE = {
    session: {
        id: "KDC-2024-0041",
        tenant_id: "t-1",
        project_name: "DATA CENTER ALPHA",
        status: "pending",
        created_at: new Date().toISOString()
    },
    documents: [
        { id: "d-1", doc_type: "blueprint", filename: "CHILLER-U4.pdf", status: "processed" },
        { id: "d-2", doc_type: "invoice", filename: "ORDER-9812.pdf", status: "processed" },
        { id: "d-3", doc_type: "site-plan", filename: "SITE-PLAN.dwg", status: "manual_review_required" }
    ],
    comparisons: [
        { id: "c-1", parameter: "UNIT_ID", blueprint_value: "CHILLER-U4", invoice_value: "KANPUR-CH-4", is_match: true, severity: "LOW" },
        { id: "c-2", parameter: "VOLTAGE", blueprint_value: "480V, 3PH", invoice_value: "240V, 3PH", is_match: false, severity: "HIGH" },
        { id: "c-3", parameter: "COOLING_CAP", blueprint_value: "450 TR", invoice_value: "450 TR", is_match: true, severity: "LOW" },
        { id: "c-4", parameter: "WEIGHT", blueprint_value: "8,400 kg", invoice_value: "8,380 kg", is_match: false, severity: "MEDIUM" }
    ]
};
