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
                                    const cellStr = typeof cell === 'string' ? cell.toUpperCase() : '';
                                    const isStatus = ['OK', 'CRITICAL', 'WARNING', 'REORDER', 'PENDING'].includes(cellStr);
                                    let statusColor = 'var(--text-primary)';
                                    if (isStatus) {
                                        if (cellStr === 'OK') statusColor = 'var(--status-ok)';
                                        else if (cellStr === 'CRITICAL') statusColor = 'var(--status-critical)';
                                        else statusColor = 'var(--status-warning)';
                                    }
                                    
                                    return (
                                        <td key={j} style={{ padding: '12px 4px', fontSize: '0.85rem', color: statusColor, borderBottom: '1px solid var(--surface-muted)' }}>
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
