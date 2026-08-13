export default function MetricCard({ title, value, delta, unit, sparklineData = [] }) {
    const isUp = delta && delta.startsWith('+');
    const isDown = delta && delta.startsWith('-');

    return (
        <div className="glass-card component-wrapper">
            <div className="panel-header">
                <span className="panel-title">{title}</span>
            </div>
            <div className="metric-body" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <span className="metric-big glow-text">{value}</span>
                {unit && <span className="metric-label">{unit}</span>}
            </div>
            {delta && (
                <div className={`metric-delta ${isUp ? 'up' : isDown ? 'down' : ''}`} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    {delta} from previous
                </div>
            )}
            {sparklineData.length > 0 && (
                <div className="mini-bars" style={{ marginTop: '16px', display: 'flex', gap: '4px', height: '30px', alignItems: 'flex-end' }}>
                    {sparklineData.map((val, i) => {
                        const max = Math.max(...sparklineData);
                        const pct = (val / max) * 100;
                        return (
                            <div key={i} className="mini-bar" style={{ 
                                height: `${pct}%`, 
                                width: '6px', 
                                background: 'var(--brushed-gold)', 
                                borderRadius: '2px',
                                transition: 'var(--transition-smooth)',
                                animationDelay: `${i * 0.08}s` 
                            }} />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
