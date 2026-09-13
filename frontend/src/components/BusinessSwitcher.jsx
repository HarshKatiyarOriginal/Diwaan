import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../api/client';

export default function BusinessSwitcher({ activeDashboardId, onDashboardSwitch, onAddBusiness, onAuthExpired, onToast }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/dashboards');
      if (res.status === 401) {
        onAuthExpired?.();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        // Defend against a malformed/unexpected response shape (e.g. an
        // error body that still resolves .ok in a test double) — never
        // let a non-array response crash the .find()/.map() calls below.
        setDashboards(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch dashboards:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch once on mount so the button shows the real active business name
  // immediately, not the "My Business" placeholder until first opened —
  // then refresh on every open so renames/deletes made elsewhere show up.
  useEffect(() => {
    fetchDashboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchDashboards();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (id) => {
    setIsOpen(false);
    if (id === activeDashboardId) return;
    onDashboardSwitch(id);
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation();
    if (!window.confirm(`Delete ${name} and all its data? This can't be undone.`)) return;
    
    try {
      const res = await apiFetch(`/api/dashboards/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onToast?.(`${name} deleted`, 'success');
        
        // If we deleted the active one, pick the next available, or trigger onAddBusiness if none left
        const remaining = dashboards.filter(d => d.id !== id);
        setDashboards(remaining);
        
        if (id === activeDashboardId) {
          if (remaining.length > 0) {
            onDashboardSwitch(remaining[0].id);
          } else {
            onAddBusiness();
          }
        }
      } else {
        onToast?.('Failed to delete business', 'error');
      }
    } catch (err) {
      onToast?.('Failed to delete business', 'error');
    }
  };

  const handleRename = async (e, id, oldName) => {
    e.stopPropagation();
    const newName = window.prompt("New business name:", oldName);
    if (!newName || newName.trim() === '' || newName === oldName) return;
    
    try {
      const res = await apiFetch(`/api/dashboards/${id}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (res.ok) {
        onToast?.('Business renamed', 'success');
        fetchDashboards();
      }
    } catch (err) {
      onToast?.('Failed to rename', 'error');
    }
  };

  const activeDash = dashboards.find(d => d.id === activeDashboardId) || { name: 'My Business' };

  return (
    <div className="business-switcher" ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'var(--glass-white)',
          padding: '6px 14px',
          borderRadius: '8px',
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'var(--transition-fast)'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
      >
        <span style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeDash.name}
        </span>
        <span style={{ fontSize: '0.7em', opacity: 0.7 }}>▼</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          width: '280px',
          background: 'var(--vault-sapphire)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 100,
          padding: '8px 0',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)'
        }}>
          {loading ? (
            <div style={{ padding: '16px', color: 'var(--muted-slate)', fontSize: '0.8rem', textAlign: 'center' }}>Loading...</div>
          ) : (
            <>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {dashboards.map(d => (
                  <div 
                    key={d.id}
                    onClick={() => handleSwitch(d.id)}
                    style={{
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: d.id === activeDashboardId ? 'rgba(255,255,255,0.05)' : 'transparent',
                      borderLeft: d.id === activeDashboardId ? '3px solid var(--brushed-gold)' : '3px solid transparent',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = d.id === activeDashboardId ? 'rgba(255,255,255,0.05)' : 'transparent'}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <span style={{ color: 'var(--glass-white)', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                      <span style={{ color: 'var(--muted-slate)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d.archetype_id.replace('_', ' ')}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => handleRename(e, d.id, d.name)} style={{ background:'transparent', border:'none', color:'var(--muted-slate)', cursor:'pointer', padding:'4px' }}>✎</button>
                      <button onClick={(e) => handleDelete(e, d.id, d.name)} style={{ background:'transparent', border:'none', color:'#ff7878', cursor:'pointer', padding:'4px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '8px 0' }} />
              <button 
                onClick={() => { setIsOpen(false); onAddBusiness(); }}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--brushed-gold)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontSize: '1.2em' }}>＋</span> Add a business
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
