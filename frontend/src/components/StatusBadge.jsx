import { useState } from 'react';
import { apiFetch } from '../api/client';

const STATUS_COLORS = {
    ok: 'var(--status-ok)',
    running: 'var(--status-ok)',
    active: 'var(--status-ok)',
    warning: 'var(--status-warning)',
    pending: 'var(--status-warning)',
    maintenance: 'var(--status-warning)',
    idle: 'var(--status-warning)',
    critical: 'var(--status-critical)',
    fault: 'var(--status-critical)',
    offline: 'var(--status-critical)',
    error: 'var(--status-critical)',
    reorder: 'var(--status-critical)',
    'gst due': 'var(--status-warning)',
    'fssai expiry': 'var(--status-critical)',
};

function getStatusColor(val) {
    if (!val) return 'var(--status-warning)';
    return STATUS_COLORS[val.toLowerCase()] || 'var(--text-primary)';
}

export default function StatusBadge({
    title,
    // Legacy props
    status: legacyStatus,
    label: legacyLabel,
    // Data-layer props
    binding,
    storedEntry,
    dashboardId,
    onDataUpdate,
}) {
    const options = binding?.options || [];
    const currentValue = storedEntry?.value_json?.value ?? legacyStatus ?? null;
    const displayLabel = currentValue || legacyLabel || 'Not set';
    const colorVar = getStatusColor(currentValue);

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [showPicker, setShowPicker] = useState(false);

    async function handleSelect(opt) {
        if (!dashboardId || !binding?.key) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await apiFetch(`/api/dashboards/${dashboardId}/data/${binding.key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: opt }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Save failed');
            }
            setShowPicker(false);
            onDataUpdate?.();
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="panel-header" style={{ marginBottom: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="panel-title">{title}</span>
                {binding && dashboardId && options.length > 0 && (
                    <button
                        className="neumorph-primary"
                        style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px' }}
                        onClick={() => { setShowPicker(!showPicker); setSaveError(null); }}
                    >
                        Set
                    </button>
                )}
            </div>

            {showPicker && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0' }}>
                    {options.map(opt => (
                        <button
                            key={opt}
                            onClick={() => handleSelect(opt)}
                            disabled={saving}
                            style={{
                                padding: '5px 12px',
                                borderRadius: '20px',
                                border: `1px solid ${getStatusColor(opt)}`,
                                background: opt === currentValue ? getStatusColor(opt) : 'transparent',
                                color: opt === currentValue ? 'var(--vault-sapphire)' : getStatusColor(opt),
                                fontSize: '0.78rem',
                                fontFamily: 'var(--font-mono)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                            }}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            {!showPicker && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
                    <div style={{ position: 'relative' }}>
                        <div
                            className="ss-agent-pulse"
                            style={{
                                position: 'absolute', top: '-4px', left: '-4px',
                                width: '28px', height: '28px',
                                background: colorVar,
                                borderRadius: '50%',
                            }}
                        />
                        <div style={{
                            position: 'relative',
                            width: '20px', height: '20px',
                            borderRadius: '50%',
                            background: colorVar,
                            zIndex: 2,
                        }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: colorVar }}>
                        {displayLabel}
                    </div>
                </div>
            )}

            {!storedEntry && !legacyStatus && !showPicker && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '8px' }}>
                    {binding && dashboardId ? (
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--brushed-gold)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                            onClick={() => setShowPicker(true)}
                        >
                            Set status
                        </button>
                    ) : 'Status not set'}
                </div>
            )}
            {saveError && <div style={{ color: 'var(--status-critical)', fontSize: '0.78rem', marginTop: '4px' }}>{saveError}</div>}
        </div>
    );
}
