import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

const CHART_COLORS = [
    'var(--primary, #d4a24c)',
    'var(--secondary, #1e3a5f)',
    'var(--accent, #7c3aed)',
    'var(--status-ok)',
    'var(--status-warning)',
];

function DonutChart({ points, unit }) {
    if (!points || points.length < 2) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                Add at least 2 data points to see the chart
            </div>
        );
    }

    // Use last 5 for donut display
    const display = points.slice(-5);
    const total = display.reduce((s, p) => s + Math.abs(p.value), 0) || 1;

    let currentPct = 0;
    const segments = display.map((p, i) => {
        const pct = (Math.abs(p.value) / total) * 100;
        const start = currentPct;
        currentPct += pct;
        return `${CHART_COLORS[i % CHART_COLORS.length]} ${start.toFixed(1)}% ${currentPct.toFixed(1)}%`;
    });
    const conicStr = `conic-gradient(${segments.join(', ')})`;

    return (
        <>
            <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: conicStr, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--surface)' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {display.map((p, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                        {new Date(p.ts).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}: {p.value.toLocaleString('en-IN', { maximumFractionDigits: 1 })}{unit ? ` ${unit}` : ''}
                    </div>
                ))}
            </div>
        </>
    );
}

function LineChart({ points, unit }) {
    if (!points || points.length < 2) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>
                Add at least 2 data points to see the chart
            </div>
        );
    }
    const vals = points.map(p => p.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals, min + 1);
    const W = 220, H = 80;
    const xStep = (W - 20) / (points.length - 1);

    const toY = v => H - 10 - ((v - min) / (max - min)) * (H - 20);
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${10 + i * xStep},${toY(p.value)}`).join(' ');

    return (
        <svg width={W} height={H} style={{ overflow: 'visible' }}>
            <defs>
                <linearGradient id="lg-spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brushed-gold)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--brushed-gold)" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${pathD} L${10 + (points.length - 1) * xStep},${H} L10,${H} Z`}
                fill="url(#lg-spark)" />
            <path d={pathD} fill="none" stroke="var(--brushed-gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, i) => (
                <circle key={i} cx={10 + i * xStep} cy={toY(p.value)} r="3" fill="var(--brushed-gold)">
                    <title>{new Date(p.ts).toLocaleDateString()}: {p.value}{unit ? ` ${unit}` : ''}</title>
                </circle>
            ))}
        </svg>
    );
}

export default function ChartWidget({
    title,
    chartType = 'donut',
    // Legacy props (kept for old blueprint compatibility)
    data: legacyData,
    // Data-layer props
    binding,
    storedEntry,
    dashboardId,
    onDataUpdate,
}) {
    const [range, setRange] = useState('30d');
    const [points, setPoints] = useState(null);  // null = loading
    const [loadError, setLoadError] = useState(null);

    const canFetch = !!(binding?.key && dashboardId);
    const unit = binding?.unit ?? '';

    useEffect(() => {
        if (!canFetch) return;
        setPoints(null);
        setLoadError(null);
        apiFetch(`/api/dashboards/${dashboardId}/series/${binding.key}?range=${range}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(data => setPoints(data.points || []))
            .catch(e => setLoadError(String(e)));
    }, [canFetch, dashboardId, binding?.key, range]);

    // If no data binding, render legacy-mode with fixed data
    if (!canFetch && legacyData) {
        const total = legacyData.reduce((s, d) => s + (d.val || 0), 0) || 1;
        let cur = 0;
        const segs = legacyData.map((d, i) => {
            const s = cur;
            cur += (d.val / total) * 100;
            return `${CHART_COLORS[i % CHART_COLORS.length]} ${s.toFixed(1)}% ${cur.toFixed(1)}%`;
        });
        return (
            <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="panel-header" style={{ alignSelf: 'flex-start', width: '100%', marginBottom: '24px' }}>
                    <span className="panel-title">{title}</span>
                </div>
                <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: `conic-gradient(${segs.join(', ')})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--surface)' }} />
                </div>
                <div style={{ display: 'flex', gap: '12px', marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {legacyData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            {d.label}: {d.val}%
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const RANGES = ['30d', '90d', '1y'];

    return (
        <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ width: '100%', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="panel-title">{title}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    {RANGES.map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            style={{
                                padding: '3px 8px',
                                fontSize: '0.68rem',
                                fontFamily: 'var(--font-mono)',
                                borderRadius: '4px',
                                border: `1px solid ${range === r ? 'var(--brushed-gold)' : 'rgba(255,255,255,0.12)'}`,
                                background: range === r ? 'rgba(212,162,76,0.12)' : 'transparent',
                                color: range === r ? 'var(--brushed-gold)' : 'var(--text-muted)',
                                cursor: 'pointer',
                            }}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                {loadError ? (
                    <div style={{ color: 'var(--status-critical)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                        Couldn&rsquo;t load chart data
                    </div>
                ) : !canFetch ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                        No data yet
                    </div>
                ) : points === null ? (
                    <div className="shimmer-card" style={{ width: '120px', height: '120px', borderRadius: '50%' }} />
                ) : chartType === 'donut' ? (
                    <DonutChart points={points} unit={unit} />
                ) : (
                    <LineChart points={points} unit={unit} />
                )}
            </div>
        </div>
    );
}
