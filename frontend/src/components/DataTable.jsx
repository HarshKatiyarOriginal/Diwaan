export default function DataTable({ title, columns, rows }) {
    return (
        <div className="glass-card component-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ marginBottom: '16px' }}>
                <span className="panel-title">{title}</span>
            </div>
            <div style={{ overflowX: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'var(--font-mono)' }}>
                    <thead>
                        <tr>
                            {columns.map((c, i) => (
                                <th key={i} style={{ padding: '8px 4px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, i) => (
                            <tr key={i}>
                                {row.map((cell, j) => {
                                    // Hacky formatting for status tags if it looks like one
                                    const isStatus = typeof cell === 'string' && ['OK', 'CRITICAL', 'WARNING'].includes(cell.toUpperCase());
                                    const statusColor = cell.toUpperCase() === 'OK' ? 'var(--status-ok)' : cell.toUpperCase() === 'CRITICAL' ? 'var(--status-critical)' : 'var(--status-warning)';
                                    
                                    return (
                                        <td key={j} style={{ padding: '12px 4px', fontSize: '0.85rem', color: isStatus ? statusColor : 'var(--text-primary)' }}>
                                            {cell}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
