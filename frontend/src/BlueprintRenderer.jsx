import { useState, useEffect, useCallback } from 'react';
import UnsupportedWidget from './components/UnsupportedWidget';
import { apiFetch } from './api/client';

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
    ListWidget,
};

/** Shimmer skeleton card while data is loading */
function SkeletonCard({ style }) {
    return (
        <div className="glass-card component-wrapper shimmer-card" style={style}>
            <div className="shimmer-line shimmer-line--title" />
            <div className="shimmer-line shimmer-line--value" />
            <div className="shimmer-line shimmer-line--sub" />
        </div>
    );
}

export default function BlueprintRenderer({ blueprint, theme, dashboardId }) {
    const [widgetData, setWidgetData] = useState({});
    const [dataLoading, setDataLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!dashboardId) return;
        setDataLoading(true);
        try {
            const res = await apiFetch(`/api/dashboards/${dashboardId}/data`);
            if (res.ok) {
                const json = await res.json();
                setWidgetData(json.data || {});
            }
        } catch (e) {
            console.warn('Failed to fetch dashboard data:', e);
        } finally {
            setDataLoading(false);
        }
    }, [dashboardId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDataUpdate = useCallback(() => {
        // Re-fetch after any widget mutation for a consistent view
        fetchData();
    }, [fetchData]);

    if (!blueprint || !blueprint.active_widgets) {
        return (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                Awaiting blueprint...
            </div>
        );
    }

    return (
        <div className="dashboard-grid">
            {blueprint.active_widgets.map((widget, idx) => {
                const Component = COMPONENT_REGISTRY[widget.component_name];

                const gridStyle = {
                    gridColumn: `span ${widget.grid_position?.span_x || 1}`,
                    gridRow: `span ${widget.grid_position?.span_y || 1}`,
                };

                // Accent morphism on first MetricCard at reveal
                const isPrimaryStatCard = idx === 0 && widget.component_name === 'MetricCard';
                const effectClass = (isPrimaryStatCard && theme && theme.accentEffect)
                    ? `effect-${theme.accentEffect}`
                    : '';

                // Data binding — key links the widget to real stored values
                const binding = widget.data_binding || null;
                const key = binding?.key;
                const storedEntry = key ? (widgetData[key] || null) : null;

                if (dataLoading && !storedEntry) {
                    return (
                        <SkeletonCard
                            key={widget.widget_id || idx}
                            style={gridStyle}
                        />
                    );
                }

                return (
                    <div
                        key={widget.widget_id || idx}
                        style={gridStyle}
                        className={effectClass ? 'has-effect' : ''}
                    >
                        {Component ? (
                            <Component
                                title={widget.title}
                                {...widget.props}
                                effectClassName={effectClass}
                                binding={binding}
                                storedEntry={storedEntry}
                                dashboardId={dashboardId}
                                onDataUpdate={handleDataUpdate}
                            />
                        ) : (
                            <UnsupportedWidget name={widget.component_name} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
