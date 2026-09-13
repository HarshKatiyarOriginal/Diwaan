import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client';

function countUp(targetNum, setDisplay, formatFn) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
        setDisplay(formatFn(targetNum));
        return () => {};
    }
    const duration = 900;
    const steps = 28;
    const stepTime = duration / steps;
    let currentStep = 0;
    const timer = setInterval(() => {
        currentStep++;
        const progress = currentStep / steps;
        const eased = 1 - Math.pow(1 - progress, 4);
        setDisplay(formatFn(targetNum * eased));
        if (currentStep >= steps) {
            clearInterval(timer);
            setDisplay(formatFn(targetNum));
        }
    }, stepTime);
    return () => clearInterval(timer);
}

function formatValue(num, unit) {
    const formatted = num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    if (unit === '₹') return `₹${formatted}`;
    if (unit) return `${formatted} ${unit}`;
    return formatted;
}

export default function MetricCard({
    title,
    // Legacy prop path (blueprint props) kept for compatibility
    value: legacyValue,
    delta: legacyDelta,
    unit: legacyUnit,
    sparklineData: legacySparkline = [],
    effectClassName = '',
    // New data-layer props
    binding,
    storedEntry,
    dashboardId,
    onDataUpdate,
}) {
    const unit = binding?.unit ?? legacyUnit ?? '';

    // Derive display value from storedEntry or legacy prop
    let numericValue = null;
    let displayInitial = '—';

    if (storedEntry?.value_json?.value !== undefined) {
        numericValue = parseFloat(storedEntry.value_json.value);
        displayInitial = formatValue(numericValue, unit);
    } else if (legacyValue !== undefined && legacyValue !== null) {
        const m = String(legacyValue).match(/[\d,.]+/);
        if (m) {
            numericValue = parseFloat(m[0].replace(/,/g, ''));
            displayInitial = legacyValue;
        }
    }

    const [displayValue, setDisplayValue] = useState(displayInitial);
    const [editing, setEditing] = useState(false);
    const [editInput, setEditInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Count-up animation whenever numericValue changes
    useEffect(() => {
        if (numericValue === null) {
            setDisplayValue('—');
            return;
        }
        return countUp(numericValue, setDisplayValue, (n) => formatValue(n, unit));
    }, [numericValue, unit]);

    // Delta from last two series points
    const last_two = storedEntry?.last_two ?? [];
    let delta = null;
    let isUp = false;
    let isDown = false;
    if (last_two.length >= 2) {
        const diff = last_two[0] - last_two[1];
        const pct = last_two[1] !== 0 ? Math.abs((diff / last_two[1]) * 100).toFixed(1) : null;
        isUp = diff > 0;
        isDown = diff < 0;
        delta = isUp
            ? `+${pct ? pct + '%' : ''} from previous`
            : isDown
            ? `-${pct ? pct + '%' : ''} from previous`
            : 'No change';
    } else if (legacyDelta) {
        delta = legacyDelta;
        isUp = legacyDelta.startsWith('+');
        isDown = legacyDelta.startsWith('-');
    }

    // Sparkline from series history (last_two is already latest-first; use for sparkline too)
    const sparkPoints = last_two.length >= 2 ? [...last_two].reverse() : legacySparkline;

    async function handleSave() {
        if (!dashboardId || !binding?.key) return;
        const val = parseFloat(editInput.replace(/[^0-9.-]/g, ''));
        if (isNaN(val)) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await apiFetch(`/api/dashboards/${dashboardId}/data/${binding.key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: val }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Save failed');
            }
            setEditing(false);
            onDataUpdate?.();
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    }

    const isEmpty = storedEntry === null && legacyValue === undefined;

    return (
        <div className={`glass-card component-wrapper ${effectClassName}`}>
            <div className="panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="panel-title">{title}</span>
                {binding && dashboardId && !editing && (
                    <button
                        className="neumorph-primary"
                        style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px' }}
                        onClick={() => { setEditing(true); setEditInput(''); setSaveError(null); }}
                        aria-label={`Update ${title}`}
                    >
                        + Update
                    </button>
                )}
            </div>

            {isEmpty && !editing ? (
                <div style={{ marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    No data yet.{' '}
                    {binding && dashboardId && (
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--brushed-gold)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                            onClick={() => { setEditing(true); setSaveError(null); }}
                        >
                            Add your first entry
                        </button>
                    )}
                </div>
            ) : editing ? (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input
                        type={binding?.input === 'currency' ? 'number' : 'number'}
                        placeholder={`Enter ${binding?.label || title}${unit ? ` (${unit})` : ''}`}
                        value={editInput}
                        onChange={e => setEditInput(e.target.value)}
                        autoFocus
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(212,162,76,0.4)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            color: 'var(--glass-white)',
                            fontFamily: 'var(--font-body)',
                            fontSize: '1rem',
                            outline: 'none',
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
                    />
                    {saveError && <div style={{ color: 'var(--status-critical)', fontSize: '0.8rem' }}>{saveError}</div>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="neumorph-primary"
                            onClick={handleSave}
                            disabled={saving}
                            style={{ flex: 1, padding: '8px' }}
                        >
                            {saving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                            onClick={() => setEditing(false)}
                            style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="metric-body" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '16px' }}>
                        <span className="metric-big glow-text">{displayValue}</span>
                        {unit && unit !== '₹' && <span className="metric-label">{unit}</span>}
                    </div>
                    {delta && (
                        <div className={`metric-delta ${isUp ? 'up' : isDown ? 'down' : ''}`} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                            {delta}
                        </div>
                    )}
                    {sparkPoints.length >= 2 && (
                        <div className="mini-bars" style={{ marginTop: '16px', display: 'flex', gap: '4px', height: '30px', alignItems: 'flex-end' }}>
                            {sparkPoints.map((val, i) => {
                                const max = Math.max(...sparkPoints, 1);
                                const pct = (val / max) * 100;
                                return (
                                    <div key={i} className="mini-bar" style={{
                                        height: `${pct}%`,
                                        width: '6px',
                                        background: 'var(--brushed-gold)',
                                        borderRadius: '2px',
                                        transition: 'var(--transition-smooth)',
                                        animationDelay: `${i * 0.08}s`,
                                    }} />
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
