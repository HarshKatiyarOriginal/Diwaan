import { useState } from 'react';

export default function LedgerToggle({ title, label, isArmed, onToggle }) {
    // For demo purposes, we manage local state if onToggle isn't fully wired to a backend
    const [armed, setArmed] = useState(isArmed || false);

    const handleClick = () => {
        setArmed(!armed);
        if (onToggle) onToggle(!armed);
    };

    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ marginBottom: 'auto' }}>
                <span className="panel-title">{title}</span>
            </div>

            <div className="sku-toggle-wrapper" style={{ marginTop: '20px' }}>
                <div
                    className={`sku-toggle ${armed ? 'active' : ''}`}
                    onClick={handleClick}
                >
                    <div className="sku-knob" />
                </div>
                <span className="sku-label" style={{ color: armed ? 'var(--status-critical)' : 'inherit' }}>
                    {armed ? `🔴 ${label} — ARMED` : label}
                </span>
            </div>
        </div>
    );
}
