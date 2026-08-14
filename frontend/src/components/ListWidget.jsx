import { THEME_ICONS } from '../themes/archetypes';

export default function ListWidget({ title, items }) {
    return (
        <div className="glass-card component-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
                <span className="panel-title">{title}</span>
            </div>
            
            <div className="live-feed" style={{ flex: 1, overflowY: 'auto' }}>
                {items.map((item, i) => {
                    const iconDisplay = THEME_ICONS[item.icon] || item.icon;
                    return (
                        <div className="feed-item" key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--surface-muted)' }}>
                            <div style={{ fontSize: '1.2rem' }}>{iconDisplay}</div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.text}</span>
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: item.dotColor || 'var(--text-primary)', flexShrink: 0, fontWeight: '500' }}>
                                {item.meta}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
