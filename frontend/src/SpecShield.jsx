import { useState } from 'react';
import './SpecShield.css';
import { SPEC_SHIELD_FIXTURE } from './fixtures';

const AGENTS = [
  { id: 'AGT-01', name: 'DocParser', task: 'Reading Blueprint PDF', color: 'blue',  status: 'active' },
  { id: 'AGT-02', name: 'SpecExtract', task: 'Extracting vendor specs', color: 'teal', status: 'active' },
  { id: 'AGT-03', name: 'Comparator', task: 'MISMATCH — VOLTAGE', color: 'red',   status: 'error'  },
];

const LOG_ENTRIES = [
  { ts: '23:44:01', msg: 'AGT-01: Blueprint CHILLER-U4 parsed successfully', cls: 'msg-blue' },
  { ts: '23:44:03', msg: 'AGT-02: Invoice ORDER-9812 extracted — 7 parameters', cls: 'msg-green' },
  { ts: '23:44:05', msg: 'AGT-03: ⚠ MISMATCH — VOLTAGE: 480V, 3PH (REQ) ≠ 240V, 3PH (INV)', cls: 'msg-red' },
  { ts: '23:44:05', msg: 'SYSTEM: Procurement status → REJECTED. Escalation triggered.', cls: 'msg-red' },
];

export default function SpecShield({ onLaunchDiwaan }) {
  const [highlighted, setHighlighted] = useState(null);
  
  const { session, documents, comparisons } = SPEC_SHIELD_FIXTURE;
  
  const blueprintDocs = documents.filter(d => d.doc_type === 'blueprint');
  const invoiceDocs = documents.filter(d => d.doc_type === 'invoice');

  const errorCount = comparisons.filter(c => !c.is_match && c.severity === 'HIGH').length;
  const warningCount = comparisons.filter(c => !c.is_match && c.severity !== 'HIGH').length;
  const okCount = comparisons.filter(c => c.is_match).length;

  return (
    <div className="ss-app">
      {/* Navbar */}
      <nav className="ss-nav">
        <div className="ss-nav-brand">
          <div className="ss-logo-mark">SS</div>
          <span className="ss-brand-name">Spec Shield</span>
          <span className="ss-brand-version">v2.4.1</span>
        </div>
        <div className="ss-nav-center">
          {session.project_name} — AUDIT SESSION #{session.id}
        </div>
        <div className="ss-nav-status">
          <span className="ss-status-dot">Engine Active</span>
          <span className="ss-agent-count">3 Agents Running</span>
          <button id="launch-diwaan-btn" className="ss-launch-btn" onClick={onLaunchDiwaan}>
            ⬡ Launch DIWAAN
          </button>
        </div>
      </nav>

      {/* Body */}
      <div className="ss-body">
        {/* Sidebar */}
        <aside className="ss-sidebar">
          {/* Project Info */}
          <div className="ss-sidebar-section">
            <div className="ss-sidebar-label">Active Project</div>
            <div className="ss-project-name">{session.project_name}</div>
            <div className="ss-project-id">{session.id}</div>
          </div>

          {/* Stats */}
          <div className="ss-sidebar-section">
            <div className="ss-sidebar-label">Audit Summary</div>
            <div className="ss-stats-grid">
              <div className="ss-stat-box">
                <div className="ss-stat-value blue">{documents.length}</div>
                <div className="ss-stat-label">Docs Audited</div>
              </div>
              <div className="ss-stat-box">
                <div className="ss-stat-value red">{errorCount}</div>
                <div className="ss-stat-label">Errors Found</div>
              </div>
              <div className="ss-stat-box">
                <div className="ss-stat-value amber">{warningCount}</div>
                <div className="ss-stat-label">Warnings</div>
              </div>
              <div className="ss-stat-box">
                <div className="ss-stat-value green">{okCount}</div>
                <div className="ss-stat-label">Params OK</div>
              </div>
            </div>
          </div>

          {/* Procurement Status */}
          <div className="ss-sidebar-section">
            <div className="ss-sidebar-label">Procurement Status</div>
            <span className="ss-badge rejected">⛔ Rejected</span>
          </div>

          {/* AI Agents */}
          <div className="ss-sidebar-section">
            <div className="ss-sidebar-label">AI Agent Nodes</div>
            <div className="ss-agent-list">
              {AGENTS.map(a => (
                <div className="ss-agent-item" key={a.id}>
                  <div className={`ss-agent-orb ${a.color}`}>{a.id.slice(-2)}</div>
                  <div className="ss-agent-info">
                    <div className="ss-agent-name">{a.name}</div>
                    <div className="ss-agent-task">{a.task}</div>
                  </div>
                  <div className={`ss-agent-pulse ${a.status}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Document List */}
          <div className="ss-sidebar-section">
            <div className="ss-sidebar-label">Documents</div>
            <div className="ss-agent-list">
              {documents.map(d => (
                <div className="ss-agent-item" key={d.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ss-text-secondary)' }}>
                    {/* SVG Monoline Icon instead of emoji */}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '6px', verticalAlign: 'middle'}}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    {d.filename}
                  </span>
                  <span className={`ss-badge ${d.status === 'processed' ? 'approved' : d.status === 'manual_review_required' ? 'pending' : 'rejected'}`}>
                    {d.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="ss-workspace">
          {/* Breadcrumb */}
          <div className="ss-breadcrumb">
            <span>SPEC SHIELD</span>
            <span>/</span>
            <span>{session.project_name}</span>
            <span>/</span>
            <span className="active">{blueprintDocs[0]?.filename} vs {invoiceDocs[0]?.filename}</span>
          </div>

          {/* Critical Alert */}
          {errorCount > 0 && (
            <div className="ss-alert-banner">
              <div className="ss-alert-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div className="ss-alert-body">
                <div className="ss-alert-title">
                  CRITICAL SPECIFICATION MISMATCH DETECTED
                </div>
                <div className="ss-alert-detail">
                  AGENT: AGT-03-COMPARATOR &nbsp;|&nbsp; FOUND {errorCount} HIGH-SEVERITY ERRORS
                </div>
              </div>
              <div className="ss-alert-severity">SEVERITY: HIGH</div>
            </div>
          )}

          {/* Comparison Grid */}
          <div className="ss-comparison-grid">
            {/* Blueprint Panel */}
            <div className="ss-doc-panel">
              <div className="ss-doc-header">
                <span className="ss-doc-type blueprint">▶ {blueprintDocs[0]?.doc_type || 'Blueprint'}</span>
                <span className="ss-doc-id">{blueprintDocs[0]?.filename}</span>
              </div>
              <div className="ss-doc-body">
                <table className="ss-spec-table">
                  <thead>
                    <tr>
                      <th>PARAMETER</th>
                      <th>REQUIRED VALUE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map(row => (
                      <tr key={row.id} onClick={() => setHighlighted(row.id)}
                        style={{ cursor: 'pointer', background: highlighted === row.id ? 'rgba(255,255,255,0.05)' : '' }}>
                        <td className="ss-spec-row-label">{row.parameter}</td>
                        <td className={row.is_match ? '' : 'highlight-blue'}>
                          {row.blueprint_value}
                        </td>
                        <td>
                          <span className={`ss-badge ${row.is_match ? 'approved' : 'pending'}`}>
                            {row.is_match ? '✓ OK' : '↔ CHECK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Center Connector */}
            <div className="ss-connector">
              <div className="ss-connector-line" />
              <div className="ss-connector-arrow">↓</div>
              <div className="ss-connector-label">Compare</div>
              <div className="ss-connector-arrow">↓</div>
              <div className="ss-connector-line" />
            </div>

            {/* Invoice Panel */}
            <div className="ss-doc-panel">
              <div className="ss-doc-header">
                <span className="ss-doc-type invoice">▶ {invoiceDocs[0]?.doc_type || 'Invoice'}</span>
                <span className="ss-doc-id">{invoiceDocs[0]?.filename}</span>
              </div>
              <div className="ss-doc-body">
                <table className="ss-spec-table">
                  <thead>
                    <tr>
                      <th>PARAMETER</th>
                      <th>SUPPLIED VALUE</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map(row => (
                      <tr key={row.id} onClick={() => setHighlighted(row.id)}
                        style={{ cursor: 'pointer', background: highlighted === row.id ? 'rgba(255,255,255,0.05)' : '' }}>
                        <td className="ss-spec-row-label">{row.parameter}</td>
                        <td className={row.is_match ? '' : 'highlight-red'}>
                          {row.invoice_value}
                        </td>
                        <td>
                          <span className={`ss-badge ${row.is_match ? 'approved' : 'rejected'} ${!row.is_match ? 'stamp' : ''}`}>
                            {row.is_match ? '✓ OK' : '✕ FAIL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Log Bar */}
          <div className="ss-log-bar">
            {LOG_ENTRIES.map((e, i) => (
              <div className="ss-log-entry" key={i}>
                <span className="ts">[{e.ts}]</span>
                <span className={e.cls}>{e.msg}</span>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
