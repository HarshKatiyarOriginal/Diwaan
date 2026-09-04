import { Suspense, lazy } from 'react';
import UnsupportedWidget from './components/UnsupportedWidget';

// Eagerly import components for the compiler
import MetricCard from './components/MetricCard';
import DataTable from './components/DataTable';
import ChartWidget from './components/ChartWidget';
import StatusBadge from './components/StatusBadge';
import LedgerToggle from './components/LedgerToggle';
import ListWidget from './components/ListWidget';

export const COMPONENT_REGISTRY = {
    MetricCard,
    DataTable,
    ChartWidget,
    StatusBadge,
    LedgerToggle,
    ListWidget
};

export default function BlueprintRenderer({ blueprint, theme }) {
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

                // Primary stat card is usually the first MetricCard
                const isPrimaryStatCard = idx === 0 && widget.component_name === 'MetricCard';
                const effectClass = (isPrimaryStatCard && theme && theme.accentEffect) ? `effect-${theme.accentEffect}` : '';

                return (
                    <div key={widget.widget_id || idx} style={gridStyle} className={effectClass ? 'has-effect' : ''}>
                        {Component ? (
                            <Component title={widget.title} {...widget.props} effectClassName={effectClass} />
                        ) : (
                            <UnsupportedWidget name={widget.component_name} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
