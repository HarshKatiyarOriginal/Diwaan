import { useState, useEffect, useRef } from 'react';
import './SpecShield.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const TASK_POLL_INTERVAL_MS = 3000;
const TASK_POLL_MAX_RETRIES = 60; // 3 min max

/**
 * Derive agent-panel entries from real document state.
 * No fabricated agent names — only real pipeline documents appear.
 */
function deriveAgents(documents) {
  if (!documents.length) return [];
  return documents.map((doc, i) => {
    let status = 'idle';
    let task = doc.filename;
    if (doc.status === 'processing') { status = 'active'; task = `Parsing ${doc.filename}…`; }
    else if (doc.status === 'processed') { status = 'done'; task = `${doc.filename} — done`; }
    else if (doc.status === 'failed') { status = 'error'; task = `${doc.filename} — failed`; }
    else if (doc.status === 'manual_review_required') { status = 'idle'; task = `${doc.filename} — manual review`; }
    return { id: `DOC-${String(i + 1).padStart(2, '0')}`, name: doc.doc_type.toUpperCase(), task, status };
  });
}

/**
 * Derive system log entries from real document + comparison state.
 * Each entry is timestamped at the time it's computed (not authored strings).
 */
function deriveLogs(documents, comparisons) {
  const logs = [];
  const now = new Date();
  const ts = (offsetSec = 0) => {
    const d = new Date(now.getTime() - offsetSec * 1000);
    return d.toTimeString().slice(0, 8);
  };
  documents.forEach((doc, i) => {
    if (doc.status === 'processed') {
      logs.push({ ts: ts(documents.length - i), msg: `${doc.doc_type.toUpperCase()} "${doc.filename}" parsed successfully`, cls: 'msg-green' });
    } else if (doc.status === 'failed') {
      logs.push({ ts: ts(documents.length - i), msg: `${doc.doc_type.toUpperCase()} "${doc.filename}" — extraction failed`, cls: 'msg-red' });
    } else if (doc.status === 'manual_review_required') {
      logs.push({ ts: ts(documents.length - i), msg: `${doc.doc_type.toUpperCase()} "${doc.filename}" — requires manual review (unsupported format)`, cls: 'msg-amber' });
    } else if (doc.status === 'processing') {
      logs.push({ ts: ts(0), msg: `${doc.doc_type.toUpperCase()} "${doc.filename}" — pipeline in progress…`, cls: 'msg-blue' });
    }
  });
  comparisons.forEach(c => {
    if (!c.is_match) {
      logs.push({ ts: ts(0), msg: `MISMATCH — ${c.parameter}: ${c.blueprint_value} (req) ≠ ${c.invoice_value} (inv) [${c.severity}]`, cls: c.severity === 'HIGH' ? 'msg-red' : 'msg-amber' });
    }
  });
  if (comparisons.length > 0 && comparisons.some(c => !c.is_match && c.severity === 'HIGH')) {
    logs.push({ ts: ts(0), msg: 'SYSTEM: Procurement status → REJECTED. High-severity mismatch found.', cls: 'msg-red' });
  }
  return logs;
}

// ─── Project Name Modal ───────────────────────────────────────────────────────
function ProjectNameModal({ onConfirm }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--ss-surface, #0f1923)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', padding: '40px', maxWidth: '480px', width: '100%',
      }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontSize: '1rem', marginBottom: '8px', letterSpacing: '0.05em' }}>
          NEW AUDIT SESSION
        </h2>
        <p style={{ color: '#6b7a99', fontSize: '0.85rem', marginBottom: '24px' }}>
          Enter a project or procurement name to begin document analysis.
        </p>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. DATA CENTER ALPHA / CHILLER-U4"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '12px 14px',
            color: '#fff', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none',
            marginBottom: '16px',
          }}
        />
        <button
          disabled={!name.trim()}
          onClick={() => onConfirm(name.trim())}
          style={{
            width: '100%', padding: '12px',
            background: name.trim() ? '#d4a24c' : 'rgba(212,162,76,0.3)',
            color: name.trim() ? '#0a0c14' : '#888',
            border: 'none', borderRadius: '8px',
            fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
            cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
          }}
        >
          CREATE SESSION
        </button>
      </div>
    </div>
  );
}

// ─── SpecShield Main ──────────────────────────────────────────────────────────
export default function SpecShield({ authToken, onLaunchDiwaan, onLogout }) {
  const [highlighted, setHighlighted] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [projectName, setProjectName] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(true);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('blueprint');
  const pollRefs = useRef({}); // task_id → retry count

  // ─── Create session ─────────────────────────────────────────────────────────
  async function createSession(name) {
    setShowProjectModal(false);
    setProjectName(name);
    try {
      const res = await fetch(`${API_BASE_URL}/api/specshield/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_name: name }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      setSessionId(data.id);
    } catch (e) {
      setUploadError(`Session creation failed: ${e.message}`);
    }
  }

  // ─── Refresh session state ───────────────────────────────────────────────────
  async function refreshSession(sid) {
    if (!sid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/specshield/sessions/${sid}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
      setComparisons(data.comparisons || []);
    } catch {
      // Non-fatal; keep showing existing state
    }
  }

  // ─── Poll Celery task ────────────────────────────────────────────────────────
  function pollTask(taskId, sid) {
    if (pollRefs.current[taskId] !== undefined) return; // already polling
    pollRefs.current[taskId] = 0;

    const interval = setInterval(async () => {
      pollRefs.current[taskId] = (pollRefs.current[taskId] || 0) + 1;
      if (pollRefs.current[taskId] > TASK_POLL_MAX_RETRIES) {
        clearInterval(interval);
        delete pollRefs.current[taskId];
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          clearInterval(interval);
          delete pollRefs.current[taskId];
          await refreshSession(sid);
        }
      } catch {
        // retry next tick
      }
    }, TASK_POLL_INTERVAL_MS);
  }

  // ─── Upload document ─────────────────────────────────────────────────────────
  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    try {
      const res = await fetch(`${API_BASE_URL}/api/specshield/sessions/${sessionId}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (res.status === 413) {
        setUploadError('File exceeds the 25 MB size limit.');
        return;
      }
      if (res.status === 415) {
        setUploadError('Unsupported file type. Please upload a PDF, JPEG, or PNG.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUploadError(body.detail || 'Upload failed.');
        return;
      }

      const data = await res.json();

      // Immediately refresh to show the new document
      await refreshSession(sessionId);

      if (data.status === 'processing' && data.task_id) {
        // Mark doc as processing in local state while we poll
        setDocuments(prev => prev.map(d =>
          String(d.id) === String(data.document_id) ? { ...d, status: 'processing' } : d
        ));
        pollTask(data.task_id, sessionId);
      }
      // manual_review_required is already reflected via refreshSession
    } catch (e) {
      setUploadError(`Upload error: ${e.message}`);
    } finally {
      setUploading(false);
      e.target.value = ''; // allow re-upload of same filename
    }
  }

  // ─── Cleanup polls on unmount ────────────────────────────────────────────────
  useEffect(() => () => { pollRefs.current = {}; }, []);

  // ─── Derived state ───────────────────────────────────────────────────────────
  const agents = deriveAgents(documents);
  const logEntries = deriveLogs(documents, comparisons);
  const blueprintDocs = documents.filter(d => d.doc_type === 'blueprint');
  const invoiceDocs = documents.filter(d => d.doc_type === 'invoice');
  const errorCount = comparisons.filter(c => !c.is_match && c.severity === 'HIGH').length;
  const warningCount = comparisons.filter(c => !c.is_match && c.severity !== 'HIGH').length;
  const okCount = comparisons.filter(c => c.is_match).length;
  const activeAgentCount = agents.filter(a => a.status === 'active').length;
  const procurementStatus = errorCount > 0 ? 'rejected' : warningCount > 0 ? 'pending' : comparisons.length > 0 ? 'approved' : null;

  return (
    <>
      {showProjectModal && <ProjectNameModal onConfirm={createSession} />}

      <div className="ss-app">
        {/* Navbar */}
        <nav className="ss-nav">
          <div className="ss-nav-brand">
            <div className="ss-logo-mark">SS</div>
            <span className="ss-brand-name">Spec Shield</span>
            <span className="ss-brand-version">v2.4.1</span>
          </div>
          <div className="ss-nav-center">
            {projectName ? `${projectName} — AUDIT SESSION` : 'New Session'}
            {sessionId && <span style={{ color: '#6b7a99', marginLeft: 8, fontSize: '0.7rem' }}>#{sessionId.slice(0, 8)}</span>}
          </div>
          <div className="ss-nav-status">
            <span className="ss-status-dot">
              {activeAgentCount > 0 ? 'Processing' : sessionId ? 'Ready' : 'Idle'}
            </span>
            {activeAgentCount > 0 && (
              <span className="ss-agent-count">{activeAgentCount} Task{activeAgentCount !== 1 ? 's' : ''} Running</span>
            )}
            <button id="launch-diwaan-btn" className="ss-launch-btn" onClick={onLaunchDiwaan}>
              ⬡ Launch DIWAAN
            </button>
            {onLogout && (
              <button onClick={onLogout} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: '#6b7a99', padding: '5px 12px', borderRadius: '6px',
                fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '8px',
              }}>
                Sign Out
              </button>
            )}
          </div>
        </nav>

        {/* Body */}
        <div className="ss-body">
          {/* Sidebar */}
          <aside className="ss-sidebar">
            {/* Project Info */}
            <div className="ss-sidebar-section">
              <div className="ss-sidebar-label">Active Project</div>
              <div className="ss-project-name">{projectName || '—'}</div>
              {sessionId && <div className="ss-project-id">{sessionId.slice(0, 8)}…</div>}
            </div>

            {/* Upload */}
            {sessionId && (
              <div className="ss-sidebar-section">
                <div className="ss-sidebar-label">Upload Document</div>
                <select
                  value={docType}
                  onChange={e => setDocType(e.target.value)}
                  style={{
                    width: '100%', marginBottom: '8px', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
                    color: '#c0c8d8', padding: '6px 8px', fontFamily: 'monospace', fontSize: '0.75rem',
                  }}
                >
                  <option value="blueprint">Blueprint (spec doc)</option>
                  <option value="invoice">Invoice / PO</option>
                  <option value="site-plan">Site Plan</option>
                </select>
                <label style={{
                  display: 'block', padding: '8px 12px',
                  background: uploading ? 'rgba(212,162,76,0.15)' : 'rgba(255,255,255,0.05)',
                  border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '6px',
                  color: '#8a95ab', fontFamily: 'monospace', fontSize: '0.72rem',
                  cursor: uploading ? 'not-allowed' : 'pointer', textAlign: 'center',
                }}>
                  {uploading ? 'Uploading…' : '+ Drop file or click (PDF / JPEG / PNG, max 25 MB)'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                {uploadError && (
                  <div style={{
                    marginTop: '8px', padding: '8px 10px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                    color: '#fca5a5', fontSize: '0.72rem', fontFamily: 'monospace',
                  }}>
                    {uploadError}
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="ss-sidebar-section">
              <div className="ss-sidebar-label">Audit Summary</div>
              <div className="ss-stats-grid">
                <div className="ss-stat-box">
                  <div className="ss-stat-value blue">{documents.length}</div>
                  <div className="ss-stat-label">Docs Uploaded</div>
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
            {procurementStatus && (
              <div className="ss-sidebar-section">
                <div className="ss-sidebar-label">Procurement Status</div>
                <span className={`ss-badge ${procurementStatus}`}>
                  {procurementStatus === 'rejected' ? '⛔ Rejected'
                    : procurementStatus === 'pending' ? '⚠ Review Required'
                    : '✓ Approved'}
                </span>
              </div>
            )}

            {/* Agent Nodes — derived from real documents */}
            {agents.length > 0 && (
              <div className="ss-sidebar-section">
                <div className="ss-sidebar-label">Pipeline Tasks</div>
                <div className="ss-agent-list">
                  {agents.map(a => (
                    <div className="ss-agent-item" key={a.id}>
                      <div className={`ss-agent-orb ${a.status === 'active' ? 'blue' : a.status === 'error' ? 'red' : 'teal'}`}>
                        {a.id.slice(-2)}
                      </div>
                      <div className="ss-agent-info">
                        <div className="ss-agent-name">{a.name}</div>
                        <div className="ss-agent-task">{a.task}</div>
                      </div>
                      <div className={`ss-agent-pulse ${a.status}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document List */}
            {documents.length > 0 && (
              <div className="ss-sidebar-section">
                <div className="ss-sidebar-label">Documents</div>
                <div className="ss-agent-list">
                  {documents.map(d => (
                    <div className="ss-agent-item" key={d.id} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '5px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--ss-text-secondary)' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        {d.filename}
                      </span>
                      <span className={`ss-badge ${d.status === 'processed' ? 'approved' : d.status === 'manual_review_required' ? 'pending' : d.status === 'processing' ? 'pending' : 'rejected'}`}>
                        {d.status === 'processing' ? '⟳ processing' : d.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Main Workspace */}
          <main className="ss-workspace">
            {/* Breadcrumb */}
            <div className="ss-breadcrumb">
              <span>SPEC SHIELD</span>
              <span>/</span>
              <span>{projectName || 'New Session'}</span>
              {(blueprintDocs[0] || invoiceDocs[0]) && (
                <>
                  <span>/</span>
                  <span className="active">
                    {blueprintDocs[0]?.filename || '—'} vs {invoiceDocs[0]?.filename || '—'}
                  </span>
                </>
              )}
            </div>

            {/* Empty / Loading State */}
            {!sessionId && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#6b7a99', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                Creating audit session…
              </div>
            )}

            {sessionId && comparisons.length === 0 && documents.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', color: '#6b7a99', fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'center' }}>
                <div>Session ready. Upload a <strong>blueprint</strong> and an <strong>invoice</strong> to begin comparison.</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Supported: PDF · JPEG · PNG (max 25 MB each)</div>
              </div>
            )}

            {sessionId && comparisons.length === 0 && documents.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#6b7a99', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {documents.some(d => d.status === 'processing')
                  ? '⟳ Documents are being processed by the AI pipeline…'
                  : 'Upload both a blueprint and an invoice to trigger comparison.'}
              </div>
            )}

            {/* Critical Alert */}
            {errorCount > 0 && (
              <div className="ss-alert-banner">
                <div className="ss-alert-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="ss-alert-body">
                  <div className="ss-alert-title">CRITICAL SPECIFICATION MISMATCH DETECTED</div>
                  <div className="ss-alert-detail">FOUND {errorCount} HIGH-SEVERITY ERROR{errorCount !== 1 ? 'S' : ''}</div>
                </div>
                <div className="ss-alert-severity">SEVERITY: HIGH</div>
              </div>
            )}

            {/* Comparison Grid */}
            {comparisons.length > 0 && (
              <div className="ss-comparison-grid">
                {/* Blueprint Panel */}
                <div className="ss-doc-panel">
                  <div className="ss-doc-header">
                    <span className="ss-doc-type blueprint">▶ {blueprintDocs[0]?.doc_type || 'Blueprint'}</span>
                    <span className="ss-doc-id">{blueprintDocs[0]?.filename}</span>
                  </div>
                  <div className="ss-doc-body">
                    <table className="ss-spec-table">
                      <thead><tr><th>PARAMETER</th><th>REQUIRED VALUE</th><th>STATUS</th></tr></thead>
                      <tbody>
                        {comparisons.map(row => (
                          <tr key={row.id} onClick={() => setHighlighted(row.id)}
                            style={{ cursor: 'pointer', background: highlighted === row.id ? 'rgba(255,255,255,0.05)' : '' }}>
                            <td className="ss-spec-row-label">{row.parameter}</td>
                            <td className={row.is_match ? '' : 'highlight-blue'}>{row.blueprint_value}</td>
                            <td><span className={`ss-badge ${row.is_match ? 'approved' : 'pending'}`}>{row.is_match ? '✓ OK' : '↔ CHECK'}</span></td>
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
                      <thead><tr><th>PARAMETER</th><th>SUPPLIED VALUE</th><th>STATUS</th></tr></thead>
                      <tbody>
                        {comparisons.map(row => (
                          <tr key={row.id} onClick={() => setHighlighted(row.id)}
                            style={{ cursor: 'pointer', background: highlighted === row.id ? 'rgba(255,255,255,0.05)' : '' }}>
                            <td className="ss-spec-row-label">{row.parameter}</td>
                            <td className={row.is_match ? '' : 'highlight-red'}>{row.invoice_value}</td>
                            <td><span className={`ss-badge ${row.is_match ? 'approved' : 'rejected'} ${!row.is_match ? 'stamp' : ''}`}>{row.is_match ? '✓ OK' : '✕ FAIL'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Log Bar — derived from real state */}
            {logEntries.length > 0 && (
              <div className="ss-log-bar">
                {logEntries.map((e, i) => (
                  <div className="ss-log-entry" key={i}>
                    <span className="ts">[{e.ts}]</span>
                    <span className={e.cls}>{e.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
