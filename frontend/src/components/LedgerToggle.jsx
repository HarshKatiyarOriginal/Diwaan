import { useState, useEffect } from 'react';
import { apiFetch } from '../api/client';

export default function LedgerToggle({
    title,
    label,
    // Legacy props
    isArmed: legacyIsArmed,
    // Data-layer props
    binding,
    storedEntry,
    dashboardId,
    onDataUpdate,
}) {
    const [lastEvent, setLastEvent] = useState(null);
    const [armed, setArmed] = useState(false);
    const [firing, setFiring] = useState(false);
    const [error, setError] = useState(null);

    const canFire = !!(binding?.key && dashboardId);
    const displayLabel = label || binding?.label || 'Commit';

    // Load last ledger event on mount
    useEffect(() => {
        if (!canFire) return;
        apiFetch(`/api/dashboards/${dashboardId}/actions/${binding.key}`)
            .then(r => r.ok ? r.json() : [])
            .then(events => {
                if (Array.isArray(events) && events.length > 0) {
                    setLastEvent(events[0]);
                }
            })
            .catch(() => {});
    }, [canFire, dashboardId, binding?.key]);

    async function handleFire() {
        if (!canFire) {
            // Legacy local-only fallback
            setArmed(!armed);
            return;
        }
        if (!armed) {
            // First click — arm it
            setArmed(true);
            return;
        }
        // Second click — confirm fire
        setFiring(true);
        setError(null);
        try {
            const res = await apiFetch(`/api/dashboards/${dashboardId}/actions/${binding.key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: displayLabel }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Failed to fire action');
            }
            const event = await res.json();
            setLastEvent(event);
            setArmed(false);
            onDataUpdate?.();
        } catch (e) {
            setError(e.message);
        } finally {
            setFiring(false);
        }
    }

    function formatEventTime(isoStr) {
        if (!isoStr) return '';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return isoStr; }
    }

    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ marginBottom: 'auto' }}>
                <span className="panel-title">{title}</span>
            </div>

            <div className="sku-toggle-wrapper" style={{ marginTop: '20px' }}>
                <div
                    className={`sku-toggle ${armed ? 'active' : ''}`}
                    onClick={firing ? undefined : handleFire}
                    style={{ cursor: firing ? 'not-allowed' : 'pointer', opacity: firing ? 0.6 : 1 }}
                    title={armed ? 'Click again to confirm' : 'Click to arm'}
                >
                    <div className="sku-knob" />
                </div>
                <span className="sku-label" style={{ color: armed ? 'var(--status-critical)' : 'inherit' }}>
                    {firing ? '⏳ Committing…' : armed ? `🔴 ${displayLabel} — CONFIRM?` : displayLabel}
                </span>
            </div>

            {armed && !firing && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <button
                        className="neumorph-primary"
                        onClick={handleFire}
                        style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
                    >
                        Confirm
                    </button>
                    <button
                        onClick={() => { setArmed(false); setError(null); }}
                        style={{ padding: '8px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                        Cancel
                    </button>
                </div>
            )}

            {lastEvent && (
                <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Last: {lastEvent.label}{lastEvent.fired_by ? ` by ${lastEvent.fired_by}` : ''} — {formatEventTime(lastEvent.fired_at)}
                </div>
            )}

            {!lastEvent && !armed && (
                <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    No events yet.
                </div>
            )}

            {error && <div style={{ color: 'var(--status-critical)', fontSize: '0.78rem', marginTop: '6px' }}>{error}</div>}
        </div>
    );
}
