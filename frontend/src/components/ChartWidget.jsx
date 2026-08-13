export default function ChartWidget({ title, chartType, data }) {
    // A CSS-only abstraction of a chart for UI Compiler demonstration
    return (
        <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="panel-header" style={{ alignSelf: 'flex-start', width: '100%', marginBottom: '24px' }}>
                <span className="panel-title">{title}</span>
            </div>
            
            {chartType === 'donut' && (
                <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: 'conic-gradient(var(--brushed-gold) 0% 60%, var(--aurora-indigo) 60% 90%, var(--muted-slate) 90% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--vault-sapphire)' }}></div>
                </div>
            )}
            
            <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: i===0 ? 'var(--brushed-gold)' : i===1 ? 'var(--aurora-indigo)' : 'var(--muted-slate)' }}></span>
                        {d.label}: {d.val}%
                    </div>
                ))}
            </div>
        </div>
    );
}
