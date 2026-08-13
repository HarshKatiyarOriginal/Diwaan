from typing import Literal

# This file is the single source of truth for the React components 
# allowed in the Diwaan dashboard blueprint generation.
# The frontend build MUST match these names exactly.

AllowedComponent = Literal[
    "MetricCard",
    "DataTable",
    "ChartWidget",
    "StatusBadge",
    "LedgerToggle",
    "ListWidget"
]
