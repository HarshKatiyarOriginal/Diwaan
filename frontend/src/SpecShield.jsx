import { useState, useEffect, useRef, useMemo } from 'react';
import './SpecShield.css';
import { apiFetch } from './api/client';

const TASK_POLL_INTERVAL_MS = 3000;
const TASK_POLL_MAX_RETRIES = 60; // 3 min max

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
function ProjectNameModal({ onConfirm, error, onCancel }) {
  const [name, setName] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: 'var(--glass-surface-elevated, #0f1923)', border: '1px solid rgba(212,162,76,0.4)',
        borderRadius: '12px', padding: '40px', maxWidth: '480px', width: '100%',
        boxShadow: 'var(--shadow-elevation-high)',
      }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', color: 'var(--brushed-gold)', fontSize: '1rem', marginBottom: '8px', letterSpacing: '0.05em' }}>
          NEW AUDIT SESSION
        </h2>
        <p style={{ color: 'var(--muted-slate)', fontSize: '0.85rem', marginBottom: '24px' }}>
          Enter a project or procurement name to begin document analysis.
        </p>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', padding: '10px 14px', borderRadius: '8px',
            fontSize: '0.85rem', marginBottom: '16px', fontFamily: 'monospace',
          }}>
            {error}
          </div>
        )}
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
        <div style={{ display: 'flex', gap: '12px' }}>
          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px', background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)', color: 'var(--muted-slate)',
                borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
          <button
            disabled={!name.trim()}
            onClick={() => onConfirm(name.trim())}
            style={{
              flex: 2, padding: '12px',
              background: name.trim() ? 'var(--brushed-gold)' : 'rgba(212,162,76,0.3)',
              color: name.trim() ? 'var(--vault-sapphire)' : '#888',
              border: 'none', borderRadius: '8px',
              fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em',
              cursor: name.trim() ? 'pointer' : 'not-allowed', fontSize: '0.85rem',
              boxShadow: name.trim() ? 'var(--neumorph-primary-raised)' : 'none',
            }}
          >
            CREATE SESSION
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SpecShield Main ──────────────────────────────────────────────────────────
export default function SpecShield({ authToken, onLaunchDiwaan, onLogout, onAuthExpired, onOpenSettings, onToast }) {
  const [highlighted, setHighlighted] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [projectName, setProjectName] = useState(null);
  const [sessionsList, setSessionsList] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [comparisons, setComparisons] = useState([]);
  const [showProjectModal, setShowProjectModal] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('blueprint');

  const pollIntervals = useRef({});
  const pollCounts = useRef({});
  const inFlight = useRef({});
  const debounceTimer = useRef(null);

  // ─── Fetch all tenant sessions (B1) ──────────────────────────────────────────
  async function loadSessions() {
    try {
      const res = await apiFetch('/api/specshield/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessionsList(data);
        if (data.length > 0 && !sessionId) {
          setShowProjectModal(false);
          selectSession(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load session history:', e);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  function selectSession(sess) {
    setSessionId(sess.id);
    setProjectName(sess.project_name);
    refreshSession(sess.id);
  }

  // ─── Delete session (B1) ────────────────────────────────────────────────────
  async function handleDeleteSession(sid) {
    try {
      const res = await apiFetch(`/api/specshield/sessions/${sid}`, { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        onToast?.('Audit session deleted', 'info');
        setDeleteConfirmId(null);
        if (sessionId === sid) {
          setSessionId(null);
          setProjectName(null);
          setDocuments([]);
          setComparisons([]);
        }
        await loadSessions();
      }
    } catch (e) {
      onToast?.('Failed to delete session', 'error');
    }
  }

  function debouncedRefreshSession(sid) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      refreshSession(sid);
    }, 300);
  }

  async function createSession(name) {
    setUploadError(null);
    setProjectName(name);
    try {
      const res = await apiFetch('/api/specshield/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: name }),
      });
      if (res.status === 401) {
        onAuthExpired?.();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Failed to create session');
      }
      const data = await res.json();
      setSessionId(data.id);
      setShowProjectModal(false);
      onToast?.(`Audit session "${name}" created`, 'success');
      await loadSessions();
    } catch (e) {
      setUploadError(`Session creation failed: ${e.message}`);
      setShowProjectModal(true);
    }
  }

  async function refreshSession(sid) {
    if (!sid) return;
    try {
      const res = await apiFetch(`/api/specshield/sessions/${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
      setComparisons(data.comparisons || []);
    } catch {
      // Non-fatal
    }
  }

  function pollTask(taskId, sid) {
    if (pollIntervals.current[taskId]) return;
    pollCounts.current[taskId] = 0;

    const interval = setInterval(async () => {
      if (inFlight.current[taskId]) return;
      inFlight.current[taskId] = true;

      pollCounts.current[taskId] = (pollCounts.current[taskId] || 0) + 1;
      if (pollCounts.current[taskId] > TASK_POLL_MAX_RETRIES) {
        clearInterval(interval);
        delete pollIntervals.current[taskId];
        delete pollCounts.current[taskId];
        delete inFlight.current[taskId];
        return;
      }

      try {
        const res = await apiFetch(`/api/tasks/${taskId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'SUCCESS' || data.status === 'FAILURE') {
          clearInterval(interval);
          delete pollIntervals.current[taskId];
          delete pollCounts.current[taskId];
          delete inFlight.current[taskId];
          debouncedRefreshSession(sid);
          if (data.status === 'SUCCESS') {
            onToast?.('Document analysis complete', 'success');
          }
        }
      } catch {
        // retry next tick
      } finally {
        inFlight.current[taskId] = false;
      }
    }, TASK_POLL_INTERVAL_MS);

    pollIntervals.current[taskId] = interval;
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setUploadError(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    try {
      const res = await apiFetch(`/api/specshield/sessions/${sessionId}/documents`, {
        method: 'POST',
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
      onToast?.(`Uploaded ${file.filename}`, 'success');

      await refreshSession(sessionId);

      if (data.status === 'processing' && data.task_id) {
        setDocuments(prev => prev.map(d =>
          String(d.id) === String(data.document_id) ? { ...d, status: 'processing' } : d
        ));
        pollTask(data.task_id, sessionId);
      }
    } catch (e) {
      setUploadError(`Upload error: ${e.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  useEffect(() => {
    return () => {
      Object.values(pollIntervals.current).forEach(id => clearInterval(id));
      pollIntervals.current = {};
      pollCounts.current = {};
      inFlight.current = {};
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const agents = useMemo(() => deriveAgents(documents), [documents]);
  const logEntries = useMemo(() => deriveLogs(documents, comparisons), [documents, comparisons]);

  const blueprintDocs = documents.filter(d => d.doc_type === 'blueprint');
  const invoiceDocs = documents.filter(d => d.doc_type === 'invoice');
  const errorCount = comparisons.filter(c => !c.is_match && c.severity === 'HIGH').length;
  const warningCount = comparisons.filter(c => !c.is_match && c.severity !== 'HIGH').length;
  const okCount = comparisons.filter(c => c.is_match).length;
  const activeAgentCount = agents.filter(a => a.status === 'active').length;
  const procurementStatus = errorCount > 0 ? 'rejected' : warningCount > 0 ? 'pending' : comparisons.length > 0 ? 'approved' : null;

  return (
    <>
      {showProjectModal && (
        <ProjectNameModal
          onConfirm={createSession}
          error={uploadError}
          onCancel={sessionsList.length > 0 ? () => setShowProjectModal(false) : null}
        />
      )}

      {/* Confirm Delete Session Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div style={{
            background: 'var(--glass-surface-elevated)', border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: '12px', padding: '32px', maxWidth: '400px', width: '100%',
          }}>
            <h3 style={{ fontFamily: 'var(--font-mono)', color: 'var(--status-critical)', marginBottom: '12px' }}>
              DELETE AUDIT SESSION
            </h3>
            <p style={{ color: 'var(--muted-slate)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Are you sure you want to delete this session? All uploaded documents and comparison results will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                  color: 'var(--muted-slate)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirmId)}
                style={{
                  flex: 1, padding: '10px', background: 'var(--status-critical)', color: '#fff',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
            {sessionId && <span style={{ color: 'var(--muted-slate)', marginLeft: 8, fontSize: '0.7rem' }}>#{sessionId.slice(0, 8)}</span>}
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
            {onOpenSettings && (
              <button onClick={onOpenSettings} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--glass-white)', padding: '5px 12px', borderRadius: '6px',
                fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '4px',
              }}>
                ⚙ Settings
              </button>
            )}
            {onLogout && (
              <button onClick={onLogout} style={{
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--muted-slate)', padding: '5px 12px', borderRadius: '6px',
                fontFamily: 'monospace', fontSize: '0.7rem', cursor: 'pointer', marginLeft: '4px',
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
            {/* Session Switcher (B1) */}
            <div className="ss-sidebar-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div className="ss-sidebar-label" style={{ marginBottom: 0 }}>Audit Sessions</div>
                <button
                  onClick={() => setShowProjectModal(true)}
                  style={{
                    background: 'transparent', border: '1px solid var(--brushed-gold)', color: 'var(--brushed-gold)',
                    borderRadius: '4px', padding: '2px 8px', fontSize: '0.65rem', fontFamily: 'monospace', cursor: 'pointer',
                  }}
                >
                  + New
                </button>
              </div>

              {sessionsList.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {sessionsList.map(s => (
                    <div
                      key={s.id}
                      onClick={() => selectSession(s)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: s.id === sessionId ? 'rgba(212,162,76,0.15)' : 'rgba(255,255,255,0.03)',
                        border: s.id === sessionId ? '1px solid var(--brushed-gold)' : '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: s.id === sessionId ? 600 : 400, color: s.id === sessionId ? 'var(--brushed-gold)' : 'var(--glass-white)' }}>
                          {s.project_name}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted-slate)', fontFamily: 'monospace' }}>
                          #{s.id.slice(0, 8)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(s.id); }}
                        style={{
                          background: 'transparent', border: 'none', color: 'rgba(239,68,68,0.7)',
                          cursor: 'pointer', padding: '2px 6px', fontSize: '0.8rem',
                        }}
                        title="Delete Session"
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Project Info */}
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
                  display: 'block', padding: '10px 12px',
                  background: uploading ? 'rgba(212,162,76,0.15)' : 'rgba(255,255,255,0.04)',
                  border: '1px dashed rgba(255,255,255,0.2)', borderRadius: '8px',
                  color: 'var(--muted-slate)', fontFamily: 'monospace', fontSize: '0.72rem',
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

            {/* Agent Nodes */}
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

            {!sessionId && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--muted-slate)', fontFamily: 'monospace', fontSize: '0.9rem', gap: '16px' }}>
                {uploadError ? (
                  <>
                    <div style={{ color: '#fca5a5', textAlign: 'center', maxWidth: '400px' }}>{uploadError}</div>
                    <button
                      onClick={() => setShowProjectModal(true)}
                      style={{
                        padding: '10px 20px', background: 'var(--brushed-gold)', color: 'var(--vault-sapphire)',
                        border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
                        boxShadow: 'var(--neumorph-primary-raised)',
                      }}
                    >
                      Retry Session Creation
                    </button>
                  </>
                ) : (
                  <div>Creating audit session…</div>
                )}
              </div>
            )}

            {sessionId && comparisons.length === 0 && documents.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: '16px', color: 'var(--muted-slate)', fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'center' }}>
                <div>Session ready. Upload a <strong>blueprint</strong> and an <strong>invoice</strong> to begin comparison.</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Supported: PDF · JPEG · PNG (max 25 MB each)</div>
              </div>
            )}

            {sessionId && comparisons.length === 0 && documents.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--muted-slate)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                {documents.some(d => d.status === 'processing')
                  ? '⟳ Documents are being processed by the AI pipeline…'
                  : 'Upload both a blueprint and an invoice to trigger comparison.'}
              </div>
            )}

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

            {comparisons.length > 0 && (
              <div className="ss-comparison-grid">
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

                <div className="ss-connector">
                  <div className="ss-connector-line" />
                  <div className="ss-connector-arrow">↓</div>
                  <div className="ss-connector-label">Compare</div>
                  <div className="ss-connector-arrow">↓</div>
                  <div className="ss-connector-line" />
                </div>

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
