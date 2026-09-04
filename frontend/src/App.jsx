import { useState, useEffect, Suspense, lazy } from 'react';
import './index.css';
import './App.css';
import SpecShield from './SpecShield';
import DiwaanSeal from './components/DiwaanSeal';
import AuthScreen from './components/AuthScreen';
import { apiFetch, setOnAuthExpired, clearSession as clientClearSession } from './api/client';

// Lazy load the heavy Diwaan module
const LandingPage = lazy(() => import('./LandingPage'));

/**
 * App manages three top-level views:
 *   'auth'       — login / register (no token found or token expired)
 *   'specshield' — default after login; real pipeline
 *   'diwaan'     — onboarding chat + generated dashboard
 */
function App() {
  const [view, setView] = useState('loading'); // 'loading' | 'auth' | 'specshield' | 'diwaan'
  const [transitioning, setTransitioning] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [tenantId, setTenantId] = useState(null);
  const [existingBlueprint, setExistingBlueprint] = useState(null);

  // ─── 401 mid-flow handler (T7 / Bug 2 Fix) ──────────────────────────────────
  function handleAuthExpired() {
    clearSession();
    setView('auth');
  }

  function clearSession() {
    clientClearSession();
    setAuthToken(null);
    setTenantId(null);
    setExistingBlueprint(null);
  }

  useEffect(() => {
    setOnAuthExpired(handleAuthExpired);
  }, []);

  // ─── Shared Dashboard Check & Routing Helper ────────────────────────────────
  async function checkDashboardAndRoute(token, tid) {
    setAuthToken(token);
    setTenantId(tid);

    try {
      const res = await apiFetch(`/api/dashboards/${tid}`);

      if (res.status === 401) {
        clearSession();
        setView('auth');
        return;
      }

      if (res.ok) {
        const blueprint = await res.json();
        setExistingBlueprint(blueprint);
        setView('diwaan');
      } else {
        setView('specshield');
      }
    } catch {
      // Network error — show specshield so user isn't stuck
      setView('specshield');
    }
  }

  // ─── Boot: check persisted session ──────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      const token = sessionStorage.getItem('diwaan_token');
      const tid = sessionStorage.getItem('diwaan_tenant_id');

      if (!token || !tid) {
        setView('auth');
        return;
      }

      await checkDashboardAndRoute(token, tid);
    }

    boot();
  }, []);

  // ─── Auth success callback ───────────────────────────────────────────────────
  async function handleAuthSuccess(token, tid) {
    await checkDashboardAndRoute(token, tid);
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
    sessionStorage.removeItem('pending_session_id');
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
          onAuthExpired={handleAuthExpired}
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
