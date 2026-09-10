import { useState, useEffect, Suspense, lazy } from 'react';
import './index.css';
import './App.css';
import SpecShield from './SpecShield';
import DiwaanSeal from './components/DiwaanSeal';
import AuthScreen from './components/AuthScreen';
import SettingsModal from './components/SettingsModal';
import Toast from './components/Toast';
import { apiFetch, setOnAuthExpired, clearSession as clientClearSession, decodeJwtPayload } from './api/client';

// Local-dev convenience: skip the login screen entirely.
// Enabled only when VITE_DEV_AUTOLOGIN === 'true' in a local .env — never in production.
const DEV_AUTOLOGIN = import.meta.env.VITE_DEV_AUTOLOGIN === 'true';
const DEV_EMAIL = import.meta.env.VITE_DEMO_EMAIL || 'demo@diwaan.local';
const DEV_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || 'secret';

async function devAutoLogin() {
  const form = new URLSearchParams();
  form.append('username', DEV_EMAIL);
  form.append('password', DEV_PASSWORD);
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!res.ok) throw new Error('dev auto-login failed');
  const { access_token } = await res.json();
  const tenantId = decodeJwtPayload(access_token).tenant_id;
  sessionStorage.setItem('diwaan_token', access_token);
  sessionStorage.setItem('diwaan_tenant_id', tenantId);
  return { token: access_token, tenantId };
}

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
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);

  function handleToast(message, type = 'info') {
    setToast({ message, type });
  }

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
      let token = sessionStorage.getItem('diwaan_token');
      let tid = sessionStorage.getItem('diwaan_tenant_id');

      if ((!token || !tid) && DEV_AUTOLOGIN) {
        try {
          ({ token, tenantId: tid } = await devAutoLogin());
        } catch {
          setView('auth');
          return;
        }
      }

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
          onOpenSettings={() => setShowSettings(true)}
          onToast={handleToast}
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
            onOpenSettings={() => setShowSettings(true)}
            onToast={handleToast}
          />
        </Suspense>
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onToast={handleToast}
        />
      )}

      <Toast
        message={toast?.message}
        type={toast?.type}
        onClose={() => setToast(null)}
      />
    </div>
  );
}

export default App;
