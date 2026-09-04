import { useState, useEffect, Suspense, lazy } from 'react';
import './index.css';
import './App.css';
import SpecShield from './SpecShield';
import DiwaanSeal from './components/DiwaanSeal';
import AuthScreen from './components/AuthScreen';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Lazy load the heavy Diwaan module
const LandingPage = lazy(() => import('./LandingPage'));

/**
 * App manages three top-level views:
 *   'auth'       — login / register (no token found or token expired)
 *   'specshield' — default after login; real pipeline
 *   'diwaan'     — onboarding chat + generated dashboard
 *
 * On mount it checks sessionStorage for a persisted token.
 * If found, it probes GET /api/dashboards/{tenantId}:
 *   - 200  → user has a completed dashboard → route straight to 'diwaan' with blueprint
 *   - 404  → user is logged in but has no dashboard yet → route to 'specshield'
 *   - 401  → token expired → clear storage → route to 'auth'
 */
function App() {
  const [view, setView] = useState('loading'); // 'loading' | 'auth' | 'specshield' | 'diwaan'
  const [transitioning, setTransitioning] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  // If the user already has a dashboard, we pre-load it so LandingPage can skip onboarding
  const [existingBlueprint, setExistingBlueprint] = useState(null);

  // ─── Boot: check persisted session ──────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const token = sessionStorage.getItem('diwaan_token');
      const tid = sessionStorage.getItem('diwaan_tenant_id');

      if (!token || !tid) {
        setView('auth');
        return;
      }

      // Token exists — check if tenant already has a dashboard
      try {
        const res = await fetch(`${API_BASE_URL}/api/dashboards/${tid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 401) {
          // Expired
          clearSession();
          setView('auth');
          return;
        }

        setAuthToken(token);
        setTenantId(tid);

        if (res.ok) {
          const blueprint = await res.json();
          setExistingBlueprint(blueprint);
          setView('diwaan');
        } else {
          // 404 or other — no dashboard yet, go to specshield
          setView('specshield');
        }
      } catch {
        // Network error during boot — still show specshield so user isn't stuck
        setAuthToken(token);
        setTenantId(tid);
        setView('specshield');
      }
    }

    boot();
  }, []);

  function clearSession() {
    sessionStorage.removeItem('diwaan_token');
    sessionStorage.removeItem('diwaan_tenant_id');
    sessionStorage.removeItem('pending_session_id');
    setAuthToken(null);
    setTenantId(null);
    setExistingBlueprint(null);
  }

  // ─── Auth success callback ───────────────────────────────────────────────────
  async function handleAuthSuccess(token, tid) {
    setAuthToken(token);
    setTenantId(tid);

    // Check for an in-progress onboarding session to resume (T7)
    // The actual resume is handled inside LandingPage via pending_session_id

    // Check if tenant already has a dashboard
    try {
      const res = await fetch(`${API_BASE_URL}/api/dashboards/${tid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blueprint = await res.json();
        setExistingBlueprint(blueprint);
        setView('diwaan');
        return;
      }
    } catch {
      // ignore — fall through to specshield
    }

    setView('specshield');
  }

  // ─── 401 mid-flow handler (T7) ───────────────────────────────────────────────
  function handleAuthExpired() {
    clearSession();
    setView('auth');
  }

  // ─── Vault transition from SpecShield → Diwaan ──────────────────────────────
  function handleLaunchDiwaan() {
    setTransitioning(true);
    setTimeout(() => {
      setExistingBlueprint(null); // fresh onboarding, not a saved blueprint
      setView('diwaan');
      setTransitioning(false);
    }, 800);
  }

  function handleBackToSpecShield() {
    setView('specshield');
  }

  function handleLogout() {
    clearSession();
    setView('auth');
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-sapphire)' }}>
        <DiwaanSeal state="generating" size="large" />
      </div>
    );
  }

  if (view === 'auth') {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* Vault Transition Overlay */}
      {transitioning && (
        <div className="vault-transition-overlay">
          <div className="vault-doors">
            <div className="vault-door left" />
            <div className="vault-door right" />
          </div>
          <div className="vault-seal-wrapper">
            <DiwaanSeal state="unlocking" size="large" />
          </div>
        </div>
      )}

      {view === 'specshield' ? (
        <SpecShield
          authToken={authToken}
          onLaunchDiwaan={handleLaunchDiwaan}
          onLogout={handleLogout}
        />
      ) : (
        <Suspense fallback={
          <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-sapphire)' }}>
            <DiwaanSeal state="generating" size="large" />
          </div>
        }>
          <LandingPage
            authToken={authToken}
            tenantId={tenantId}
            initialBlueprint={existingBlueprint}
            onBack={handleBackToSpecShield}
            onAuthExpired={handleAuthExpired}
            onLogout={handleLogout}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
