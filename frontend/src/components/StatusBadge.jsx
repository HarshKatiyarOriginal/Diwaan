export default function StatusBadge({ title, status, label }) {
    const isOk = status === 'ok';
    const isWarning = status === 'warning';
    
    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="panel-header" style={{ marginBottom: 'auto' }}>
                <span className="panel-title">{title}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
                <div style={{ position: 'relative' }}>
                    <div className={`ss-agent-pulse ${isOk ? 'active' : isWarning ? 'warning' : 'error'}`} style={{ position: 'absolute', top: '-4px', left: '-4px', width: '28px', height: '28px', background: isOk ? 'var(--status-ok)' : isWarning ? 'var(--status-warning)' : 'var(--status-critical)' }} />
                    <div style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '50%', background: isOk ? 'var(--status-ok)' : isWarning ? 'var(--status-warning)' : 'var(--status-critical)', zIndex: 2 }} />
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: isOk ? 'var(--status-ok)' : isWarning ? 'var(--status-warning)' : 'var(--status-critical)' }}>
                    {label}
                </div>
            </div>
        </div>
    );
}
