export default function ChartWidget({ title, chartType, data }) {
    // Dynamically build conic gradient based on actual data
    let conicString = '';
    let currentPct = 0;
    const colors = ['var(--primary)', 'var(--secondary)', 'var(--accent)'];
    
    if (chartType === 'donut' && data && data.length > 0) {
        const segments = data.map((d, i) => {
            const start = currentPct;
            currentPct += d.val;
            return `${colors[i % colors.length]} ${start}% ${currentPct}%`;
        });
        conicString = `conic-gradient(${segments.join(', ')})`;
    } else {
        conicString = 'conic-gradient(var(--primary) 0% 100%)';
    }

    return (
        <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="panel-header" style={{ alignSelf: 'flex-start', width: '100%', marginBottom: '24px' }}>
                <span className="panel-title">{title}</span>
            </div>
            
            {chartType === 'donut' && (
                <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: conicString, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'var(--surface)' }}></div>
                </div>
            )}
            
            <div style={{ display: 'flex', gap: '16px', marginTop: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                {data.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i % colors.length] }}></span>
                        {d.label}: {d.val}%
                    </div>
                ))}
            </div>
        </div>
    );
}
