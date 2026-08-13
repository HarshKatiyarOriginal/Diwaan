import { Suspense, lazy } from 'react';
import UnsupportedWidget from './components/UnsupportedWidget';

// Eagerly import components for the compiler
import MetricCard from './components/MetricCard';
import DataTable from './components/DataTable';
import ChartWidget from './components/ChartWidget';
import StatusBadge from './components/StatusBadge';
import LedgerToggle from './components/LedgerToggle';
import ListWidget from './components/ListWidget';

const COMPONENT_REGISTRY = {
    MetricCard,
    DataTable,
    ChartWidget,
    StatusBadge,
    LedgerToggle,
    ListWidget
};

export default function BlueprintRenderer({ blueprint }) {
    if (!blueprint || !blueprint.active_widgets) {
        return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Awaiting blueprint...</div>;
    }

    return (
        <div className="dashboard-grid">
            {blueprint.active_widgets.map((widget, idx) => {
                const Component = COMPONENT_REGISTRY[widget.component_name];
                
                const gridStyle = {
                    gridColumn: `span ${widget.grid_position?.span_x || 1}`,
                    gridRow: `span ${widget.grid_position?.span_y || 1}`
                };

                return (
                    <div key={widget.widget_id || idx} style={gridStyle}>
                        {Component ? (
                            <Component title={widget.title} {...widget.props} />
                        ) : (
                            <UnsupportedWidget name={widget.component_name} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
