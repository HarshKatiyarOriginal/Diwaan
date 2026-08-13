export default function UnsupportedWidget({ name }) {
    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', border: '1px dashed var(--ember-copper)', background: 'rgba(193, 102, 58, 0.05)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ember-copper)', textAlign: 'center' }}>
                Unsupported Widget: <br/><strong style={{color: 'var(--text-primary)'}}>{name}</strong>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                This component is not registered in the UI Compiler.
            </div>
        </div>
    );
}
