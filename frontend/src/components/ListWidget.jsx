import { useState } from 'react';
import { THEME_ICONS } from '../themes/archetypes';
import { apiFetch } from '../api/client';

const DOT_COLORS = {
    ok: 'var(--status-ok)',
    done: 'var(--status-ok)',
    complete: 'var(--status-ok)',
    warning: 'var(--status-warning)',
    pending: 'var(--status-warning)',
    critical: 'var(--status-critical)',
    error: 'var(--status-critical)',
};

function resolveDotColor(meta) {
    if (!meta) return 'var(--text-primary)';
    const lower = meta.toLowerCase();
    for (const [k, v] of Object.entries(DOT_COLORS)) {
        if (lower.includes(k)) return v;
    }
    return 'var(--brushed-gold)';
}

export default function ListWidget({
    title,
    // Legacy prop
    items: legacyItems,
    // Data-layer props
    binding,
    storedEntry,
    dashboardId,
    onDataUpdate,
}) {
    const storedItems = storedEntry?.value_json?.value ?? null;
    const items = storedItems !== null ? storedItems : (legacyItems || []);

    const [addingItem, setAddingItem] = useState(false);
    const [newText, setNewText] = useState('');
    const [newMeta, setNewMeta] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    const canEdit = !!(binding?.key && dashboardId);

    async function persistItems(updated) {
        if (!canEdit) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await apiFetch(`/api/dashboards/${dashboardId}/data/${binding.key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: updated }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j.error || 'Save failed');
            }
            onDataUpdate?.();
        } catch (e) {
            setSaveError(e.message);
        } finally {
            setSaving(false);
        }
    }

    function handleAddItem() {
        if (!newText.trim()) return;
        const newItem = {
            icon: '📌',
            text: newText.trim(),
            meta: newMeta.trim() || new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            dotColor: 'var(--brushed-gold)',
        };
        const updated = [newItem, ...items].slice(0, 20); // cap at 20
        setNewText('');
        setNewMeta('');
        setAddingItem(false);
        persistItems(updated);
    }

    function handleDeleteItem(idx) {
        const updated = items.filter((_, i) => i !== idx);
        persistItems(updated);
    }

    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="panel-title">{title}</span>
                {canEdit && (
                    <button
                        className="neumorph-primary"
                        style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px' }}
                        onClick={() => { setAddingItem(true); setSaveError(null); }}
                    >
                        + Add
                    </button>
                )}
            </div>

            {addingItem && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                    <input
                        autoFocus
                        value={newText}
                        onChange={e => setNewText(e.target.value)}
                        placeholder="Activity description"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(212,162,76,0.35)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            color: 'var(--glass-white)',
                            fontFamily: 'var(--font-body)',
                            fontSize: '0.85rem',
                            outline: 'none',
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddItem(); if (e.key === 'Escape') setAddingItem(false); }}
                    />
                    <input
                        value={newMeta}
                        onChange={e => setNewMeta(e.target.value)}
                        placeholder="Note / status (optional)"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            color: 'var(--text-muted)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            outline: 'none',
                        }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            className="neumorph-primary"
                            onClick={handleAddItem}
                            disabled={saving}
                            style={{ flex: 1, padding: '6px', fontSize: '0.8rem' }}
                        >
                            {saving ? '…' : 'Add Entry'}
                        </button>
                        <button
                            onClick={() => setAddingItem(false)}
                            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="live-feed" style={{ flex: 1, overflowY: 'auto' }}>
                {items.length === 0 && !addingItem ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingTop: '8px' }}>
                        No activity yet.{' '}
                        {canEdit && (
                            <button
                                style={{ background: 'none', border: 'none', color: 'var(--brushed-gold)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                                onClick={() => setAddingItem(true)}
                            >
                                Add the first entry
                            </button>
                        )}
                    </div>
                ) : (
                    items.map((item, i) => {
                        const iconDisplay = (THEME_ICONS && THEME_ICONS[item.icon]) || item.icon || '📌';
                        const dotColor = item.dotColor || resolveDotColor(item.meta);
                        return (
                            <div
                                key={i}
                                className="feed-item"
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--surface-muted)', position: 'relative' }}
                            >
                                <div style={{ fontSize: '1.1rem', flexShrink: 0 }}>{iconDisplay}</div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                    <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: dotColor, flexShrink: 0, fontWeight: 500 }}>
                                    {item.meta}
                                </span>
                                {canEdit && (
                                    <button
                                        onClick={() => handleDeleteItem(i)}
                                        disabled={saving}
                                        style={{ background: 'none', border: 'none', color: 'var(--status-critical)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px', opacity: 0.6 }}
                                        title="Remove"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
            {saveError && <div style={{ color: 'var(--status-critical)', fontSize: '0.78rem', marginTop: '6px' }}>{saveError}</div>}
        </div>
    );
}
