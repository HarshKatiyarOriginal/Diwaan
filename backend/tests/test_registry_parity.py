from backend.schemas.component_registry import AllowedComponent

FRONTEND_REGISTRY = {
    "MetricCard",
    "DataTable",
    "ChartWidget",
    "StatusBadge",
    "LedgerToggle",
    "ListWidget",
}


def test_component_registry_parity():
    backend_set = set(AllowedComponent.__args__)
    assert (
        backend_set == FRONTEND_REGISTRY
    ), f"Registry drift: {backend_set ^ FRONTEND_REGISTRY}"
