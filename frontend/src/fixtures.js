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
