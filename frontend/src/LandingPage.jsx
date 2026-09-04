import { useState, useEffect } from 'react';
import './LandingPage.css';
import DiwaanSeal from './components/DiwaanSeal';
import BlueprintRenderer from './BlueprintRenderer';
import { KIRANA_SHOP_BLUEPRINT, FARM_BLUEPRINT, PAPER_FACTORY_BLUEPRINT, ICE_CREAM_FACTORY_BLUEPRINT, TILES_FACTORY_BLUEPRINT } from './fixtures';
import { ARCHETYPES, validateTheme } from './themes/archetypes';
import OnboardingChat from './components/OnboardingChat';
import { mockStartSession, mockRespond } from './onboardingMock';
import { apiFetch } from './api/client';

// Explicit opt-in only — never true in production
const IS_MOCK = import.meta.env.VITE_ONBOARDING_MOCK === 'true';

// Fallback when the LLM omits visual_theme (should not happen after T3)
export const ARCHETYPE_THEME_FALLBACKS = {
  farmer: 'farm',
  shopkeeper: 'kirana-shop',
  factory_owner: 'paper-factory',
};

// ─── Theme resolution ────────────────────────────────────────────────────────
export function resolveTheme(blueprint) {
  if (!blueprint) return null;
  // 1. Use LLM-selected theme (new field)
  if (blueprint.visual_theme) {
    const t = ARCHETYPES.find(a => a.id === blueprint.visual_theme);
    if (t) return t;
  }
  // 2. Fall back to archetype's canonical theme (never silently kirana-shop)
  const fallbackId = ARCHETYPE_THEME_FALLBACKS[blueprint.archetype];
  return ARCHETYPES.find(a => a.id === fallbackId) || ARCHETYPES[0];
}

function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * LandingPage — onboarding chat + dashboard renderer.
 */
function LandingPage({ authToken, tenantId, initialBlueprint, onBack, onAuthExpired, onLogout }) {
  const [session, setSession] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [activeBlueprint, setActiveBlueprint] = useState(initialBlueprint || null);
  const [sampleMode, setSampleMode] = useState(false);
  const [sampleTab, setSampleTab] = useState('kirana-shop');

  // ─── Start / Resume onboarding session ─────────────────────────────────────
  useEffect(() => {
    if (activeBlueprint) return;

    async function init() {
      setIsThinking(true);
      try {
        let data;

        if (IS_MOCK) {
          data = await mockStartSession();
        } else {
          const pendingSessionId = sessionStorage.getItem('pending_session_id');

          if (pendingSessionId) {
            const res = await apiFetch(`/api/onboarding/sessions/${pendingSessionId}`);

            if (res.status === 401) {
              onAuthExpired?.();
              return;
            }

            if (res.ok) {
              const sessionData = await res.json();
              if (sessionData.status === 'in_progress' && sessionData.question) {
                sessionStorage.removeItem('pending_session_id');
                setSession({
                  id: pendingSessionId,
                  status: 'in_progress',
                  conversation: [{ role: 'assistant', content: sessionData.question }],
                });
                return;
              }
              if (sessionData.status === 'complete' && sessionData.blueprint) {
                sessionStorage.removeItem('pending_session_id');
                setActiveBlueprint(sessionData.blueprint);
                return;
              }
            }
            sessionStorage.removeItem('pending_session_id');
          }

          const res = await apiFetch('/api/onboarding/sessions', {
            method: 'POST',
          });

          if (res.status === 401) {
            onAuthExpired?.();
            return;
          }
          if (!res.ok) throw new Error('Failed to start session');
          data = await res.json();
        }

        setSession({
          id: data.session_id,
          status: 'in_progress',
          conversation: [{ role: 'assistant', content: data.question }],
        });
      } catch (e) {
        console.error('Failed to start session:', e);
      } finally {
        setIsThinking(false);
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Send a message in the interview ────────────────────────────────────────
  const handleSendMessage = async (text) => {
    if (!session || session.status !== 'in_progress') return;

    const updatedConversation = [...session.conversation, { role: 'user', content: text }];
    setSession({ ...session, conversation: updatedConversation });
    setIsThinking(true);

    try {
      let data;

      if (IS_MOCK) {
        const turnCount = updatedConversation.filter(m => m.role === 'assistant').length;
        data = await mockRespond(session.id, text, turnCount);
      } else {
        const res = await apiFetch(
          `/api/onboarding/sessions/${session.id}/respond`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ answer: text }),
          }
        );

        if (res.status === 401) {
          sessionStorage.setItem('pending_session_id', session.id);
          onAuthExpired?.();
          setIsThinking(false);
          return;
        }

        if (res.status === 502) {
          setSession({
            ...session,
            conversation: [
              ...updatedConversation,
              { role: 'assistant', content: '⚠️ The AI had trouble understanding that. Please try rephrasing.' },
            ],
          });
          setIsThinking(false);
          return;
        }

        if (!res.ok) throw new Error('Failed to respond');
        data = await res.json();
      }

      if (data.status === 'in_progress') {
        setSession({
          ...session,
          status: data.status,
          conversation: [...updatedConversation, { role: 'assistant', content: data.question }],
        });
      } else if (data.status === 'complete' || data.status === 'ready_to_generate') {
        setSession({ ...session, status: 'complete', conversation: updatedConversation });
        setTimeout(() => {
          setActiveBlueprint(data.blueprint);
          setIsThinking(false);
        }, 1500);
        return;
      }
    } catch (e) {
      console.error('Failed to respond:', e);
      setSession({
        ...session,
        conversation: [
          ...updatedConversation,
          { role: 'assistant', content: '⚠️ Connection lost or validation failed. Please try again.' },
        ],
      });
    }

    setIsThinking(false);
  };

  // ─── Shared inline style builder for theme-root ──────────────────────────────
  function themeRootStyle(theme) {
    return {
      '--primary': theme.palette.primary,
      '--secondary': theme.palette.secondary,
      '--accent': theme.palette.accent,
      '--background': theme.palette.background,
      '--surface': theme.palette.surface,
      '--surface-muted': theme.palette.surfaceMuted,
      '--text-primary': theme.palette.textPrimary,
      '--text-muted': theme.palette.textMuted,
      '--status-ok': theme.palette.statusOk,
      '--status-warning': theme.palette.statusWarning,
      '--status-critical': theme.palette.statusCritical,
      '--surface-glass': hexToRgba(theme.palette.surface, 0.55),
      '--surface-muted-glass': hexToRgba(theme.palette.surfaceMuted, 0.4),
      '--accent-glass': hexToRgba(theme.palette.accent, 0.1),
      '--card-radius': theme.cardRadius === 'sharp' ? '4px' : '16px',
      backgroundColor: 'var(--background)',
      padding: '24px',
      borderRadius: '12px',
      transition: 'var(--transition-smooth)',
    };
  }

  return (
    <div className="page">
      {/* Background System */}
      <div className="background-system" style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'var(--vault-sapphire)' }}>
        {ARCHETYPES.map((theme) => {
          const resolvedTheme = activeBlueprint ? resolveTheme(activeBlueprint) : null;
          const isActive = activeBlueprint
            ? (resolvedTheme && theme.id === resolvedTheme.id)
            : theme.id === sampleTab;
          return (
            <img
              key={theme.id}
              src={`/theme-backgrounds/${theme.id}.webp`}
              alt=""
              loading={isActive ? 'eager' : 'lazy'}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', opacity: isActive ? 1 : 0,
                transition: 'opacity 0.6s ease-in-out', pointerEvents: 'none',
              }}
            />
          );
        })}
        <div className="background-scrim" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.75))',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Nav */}
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="nav-logo glow-text">DIWAAN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button onClick={onBack} style={{
              fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: '600',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--muted-slate)', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px',
              borderRadius: '100px', cursor: 'pointer', transition: 'var(--transition-smooth)',
            }}
            onMouseOver={e => e.target.style.color = 'var(--glass-white)'}
            onMouseOut={e => e.target.style.color = 'var(--muted-slate)'}
            >
              ← Spec Shield
            </button>
          )}
          {onLogout && (
            <button onClick={onLogout} style={{
              fontFamily: 'var(--font-body)', fontSize: '0.7rem', fontWeight: '600',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--muted-slate)', background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)', padding: '6px 14px',
              borderRadius: '100px', cursor: 'pointer', transition: 'var(--transition-smooth)',
            }}>
              Sign Out
            </button>
          )}
          <span className="nav-badge">AI Business Intelligence</span>
          {IS_MOCK && <span style={{ color: '#ffb020', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>(Mock)</span>}
        </div>
      </nav>

      {/* Hero / Chat Section */}
      {!activeBlueprint && !sampleMode && (
        <section className="hero" style={{ paddingBottom: '40px' }}>
          <div className="hero-eyebrow">
            <span className="dot" />
            Powered by Gemini AI
          </div>
          <h1 className="hero-title" style={{ fontSize: '3rem', marginBottom: '24px' }}>
            <span className="glow-text">Let&apos;s build</span> your platform.
          </h1>

          {IS_MOCK && (
            <div style={{
              background: 'rgba(255, 176, 32, 0.1)', border: '1px solid var(--brushed-gold)',
              color: 'var(--brushed-gold)', padding: '12px 24px', borderRadius: '8px',
              maxWidth: '800px', margin: '0 auto 24px auto', fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem', letterSpacing: '0.05em',
            }}>
              ⚠ SCRIPTED PREVIEW: Showing a pre-recorded example flow. This is not a live AI session.
            </div>
          )}

          {session ? (
            <OnboardingChat
              session={session}
              isThinking={isThinking}
              onSendMessage={handleSendMessage}
              isMock={IS_MOCK}
            />
          ) : (
            <div style={{ height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DiwaanSeal state="generating" size="large" />
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '32px' }}>
            <button
              className="view-samples-btn"
              onClick={() => setSampleMode(true)}
              style={{
                background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)',
                color: 'var(--muted-slate)', padding: '10px 24px', borderRadius: '100px',
                fontFamily: 'var(--font-body)', fontSize: '0.85rem', cursor: 'pointer',
                transition: 'var(--transition-smooth)',
              }}
              onMouseOver={e => { e.target.style.color = 'var(--glass-white)'; e.target.style.borderColor = 'rgba(255,255,255,0.4)'; }}
              onMouseOut={e => { e.target.style.color = 'var(--muted-slate)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
            >
              View Sample Dashboards
            </button>
          </div>
        </section>
      )}

      {/* Dashboard Area */}
      <section className="dashboard-section" id="dashboard-target">
        {sampleMode ? (
          <div className="sample-dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="sample-tabs" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ARCHETYPES.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => setSampleTab(theme.id)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid',
                      borderColor: sampleTab === theme.id ? 'var(--brushed-gold)' : 'rgba(255,255,255,0.1)',
                      background: sampleTab === theme.id ? 'rgba(255, 176, 32, 0.1)' : 'transparent',
                      color: sampleTab === theme.id ? 'var(--brushed-gold)' : 'var(--muted-slate)',
                      fontFamily: 'var(--font-mono)', fontSize: '0.85rem',
                      textTransform: 'uppercase', cursor: 'pointer', transition: 'var(--transition-fast)',
                    }}
                  >
                    {theme.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setSampleMode(false)} style={{
                background: 'transparent', border: 'none', color: 'var(--muted-slate)',
                fontFamily: 'var(--font-body)', cursor: 'pointer', textDecoration: 'underline',
              }}>
                Back to Onboarding
              </button>
            </div>

            <div style={{
              background: '#cc0000', color: '#ffffff', padding: '12px', textAlign: 'center',
              fontWeight: 'bold', letterSpacing: '0.1em', fontFamily: 'var(--font-body)',
              borderRadius: '8px', boxShadow: '0 4px 12px rgba(204,0,0,0.3)',
            }}>
              ⚠ SAMPLE DATA — FOR DEMONSTRATION ONLY
            </div>

            {(() => {
              const theme = ARCHETYPES.find(t => t.id === sampleTab);
              if (!validateTheme(theme)) {
                return (
                  <div style={{
                    background: 'repeating-linear-gradient(45deg,#FFD700,#FFD700 10px,#FF0000 10px,#FF0000 20px)',
                    color: 'white', padding: '40px', textAlign: 'center', borderRadius: '8px', fontWeight: 'bold',
                  }}>
                    <h2>⚠ THEME NOT CONFIGURED</h2>
                    <p>The configuration for archetype &quot;{sampleTab}&quot; is missing or invalid.</p>
                  </div>
                );
              }

              const blueprint = sampleTab === 'kirana-shop' ? KIRANA_SHOP_BLUEPRINT
                : sampleTab === 'farm' ? FARM_BLUEPRINT
                : sampleTab === 'paper-factory' ? PAPER_FACTORY_BLUEPRINT
                : sampleTab === 'ice-cream-factory' ? ICE_CREAM_FACTORY_BLUEPRINT
                : TILES_FACTORY_BLUEPRINT;

              return (
                <div className={`theme-root motif-${theme.backgroundMotif} accent-${theme.accentEffect}`} style={themeRootStyle(theme)}>
                  <BlueprintRenderer blueprint={blueprint} theme={theme} />
                </div>
              );
            })()}
          </div>

        ) : session?.status === 'complete' && isThinking ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '32px' }}>
            <DiwaanSeal state="generating" size="large" />
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--brushed-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Compiling Blueprint Parameters…
            </div>
          </div>

        ) : activeBlueprint ? (
          <>
            <p className="section-label" style={{ marginTop: '40px' }}>
              {initialBlueprint ? 'Your Dashboard' : 'Live Preview'} — {activeBlueprint.archetype.replace('_', ' ')}
            </p>
            {(() => {
              const theme = resolveTheme(activeBlueprint);
              if (!theme || !validateTheme(theme)) return null;
              return (
                <div className={`theme-root motif-${theme.backgroundMotif} accent-${theme.accentEffect}`} style={themeRootStyle(theme)}>
                  <BlueprintRenderer blueprint={activeBlueprint} theme={theme} />
                </div>
              );
            })()}
          </>
        ) : null}
      </section>
    </div>
  );
}

export default LandingPage;
