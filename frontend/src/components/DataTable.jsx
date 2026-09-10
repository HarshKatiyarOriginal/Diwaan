import { useState } from 'react';
import { apiFetch } from '../api/client';

const STATUS_KEYWORDS = ['OK', 'CRITICAL', 'WARNING', 'REORDER', 'PENDING', 'FAULT'];

function statusColor(cell) {
    const u = typeof cell === 'string' ? cell.toUpperCase() : '';
    if (u === 'OK') return 'var(--status-ok)';
    if (['CRITICAL', 'REORDER', 'FAULT'].includes(u)) return 'var(--status-critical)';
    if (['WARNING', 'PENDING'].includes(u)) return 'var(--status-warning)';
    return 'var(--text-primary)';
}

function isStatus(cell) {
    return STATUS_KEYWORDS.includes(typeof cell === 'string' ? cell.toUpperCase() : '');
}

export default function DataTable({
    title,
    // Legacy props (kept for compatibility)
    columns: legacyColumns,
    rows: legacyRows,
    // Data-layer props
    binding,
    storedEntry,
    tenantId,
    onDataUpdate,
}) {
    const columns = binding?.columns?.length > 0 ? binding.columns : (legacyColumns || []);
    const storedRows = storedEntry?.value_json?.value ?? null;
    const rows = storedRows !== null ? storedRows : (legacyRows || []);

    const [addingRow, setAddingRow] = useState(false);
    const [newRow, setNewRow] = useState(() => columns.map(() => ''));
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    async function persistRows(updatedRows) {
        if (!tenantId || !binding?.key) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await apiFetch(`/api/dashboards/${tenantId}/data/${binding.key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: updatedRows }),
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

    function handleAddRow() {
        const trimmed = newRow.map(c => c.trim());
        if (trimmed.every(c => c === '')) return;
        const updated = [...rows, trimmed];
        setNewRow(columns.map(() => ''));
        setAddingRow(false);
        persistRows(updated);
    }

    function handleDeleteRow(idx) {
        const updated = rows.filter((_, i) => i !== idx);
        persistRows(updated);
    }

    const isEmpty = rows.length === 0;
    const canEdit = !!(binding && tenantId);

    return (
        <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="panel-title">{title}</span>
                {canEdit && (
                    <button
                        className="neumorph-primary"
                        style={{ fontSize: '0.7rem', padding: '4px 10px', borderRadius: '6px' }}
                        onClick={() => { setAddingRow(true); setSaveError(null); }}
                    >
                        + Add Row
                    </button>
                )}
            </div>

            {isEmpty && !addingRow ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px 0' }}>
                    No entries yet.{' '}
                    {canEdit && (
                        <button
                            style={{ background: 'none', border: 'none', color: 'var(--brushed-gold)', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
                            onClick={() => setAddingRow(true)}
                        >
                            Add the first row
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ overflowX: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
                        <thead>
                            <tr>
                                {columns.map((c, i) => (
                                    <th key={i} style={{ padding: '8px 4px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {c}
                                    </th>
                                ))}
                                {canEdit && <th style={{ width: '32px' }} />}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {(Array.isArray(row) ? row : []).map((cell, j) => (
                                        <td key={j} style={{ padding: '10px 4px', fontSize: '0.85rem', color: isStatus(cell) ? statusColor(cell) : 'var(--text-primary)', borderBottom: '1px solid var(--surface-muted)' }}>
                                            {cell}
                                        </td>
                                    ))}
                                    {canEdit && (
                                        <td style={{ padding: '10px 4px', borderBottom: '1px solid var(--surface-muted)' }}>
                                            <button
                                                onClick={() => handleDeleteRow(i)}
                                                disabled={saving}
                                                style={{ background: 'none', border: 'none', color: 'var(--status-critical)', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px' }}
                                                title="Delete row"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {addingRow && (
                                <tr>
                                    {newRow.map((val, i) => (
                                        <td key={i} style={{ padding: '6px 4px' }}>
                                            <input
                                                value={val}
                                                onChange={e => {
                                                    const updated = [...newRow];
                                                    updated[i] = e.target.value;
                                                    setNewRow(updated);
                                                }}
                                                placeholder={columns[i] || ''}
                                                autoFocus={i === 0}
                                                style={{
                                                    width: '100%',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(212,162,76,0.35)',
                                                    borderRadius: '4px',
                                                    padding: '5px 8px',
                                                    color: 'var(--glass-white)',
                                                    fontFamily: 'var(--font-mono)',
                                                    fontSize: '0.82rem',
                                                    outline: 'none',
                                                    minWidth: '80px',
                                                }}
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddRow(); if (e.key === 'Escape') setAddingRow(false); }}
                                            />
                                        </td>
                                    ))}
                                    <td style={{ padding: '6px 4px' }}>
                                        <button
                                            className="neumorph-primary"
                                            onClick={handleAddRow}
                                            disabled={saving}
                                            style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', marginRight: '4px' }}
                                        >
                                            {saving ? '…' : '✓'}
                                        </button>
                                        <button
                                            onClick={() => setAddingRow(false)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                                        >
                                            ✕
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
            {saveError && <div style={{ color: 'var(--status-critical)', fontSize: '0.78rem', marginTop: '6px' }}>{saveError}</div>}
        </div>
    );
}
