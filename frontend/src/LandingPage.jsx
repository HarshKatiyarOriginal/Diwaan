import { useState } from 'react';
import './LandingPage.css';
import DiwaanSeal from './components/DiwaanSeal';
import BlueprintRenderer from './BlueprintRenderer';
import { FACTORY_OWNER_BLUEPRINT, SHOPKEEPER_BLUEPRINT, MALFORMED_BLUEPRINT } from './fixtures';

const EXAMPLE_PROMPTS = [
  { text: 'Cycle factory, Kanpur', fixture: FACTORY_OWNER_BLUEPRINT },
  { text: 'Electronics shop, Mumbai', fixture: SHOPKEEPER_BLUEPRINT },
  { text: 'Malformed fallback test', fixture: MALFORMED_BLUEPRINT },
];

function LandingPage({ onBack }) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeBlueprint, setActiveBlueprint] = useState(null);

  function handleChip(text) {
    setPrompt(text);
  }

  function handleGenerate() {
    if (!prompt) return;
    
    // Find matching fixture or default to Factory
    const match = EXAMPLE_PROMPTS.find(ex => ex.text === prompt);
    const fixtureToLoad = match ? match.fixture : FACTORY_OWNER_BLUEPRINT;

    setIsGenerating(true);
    setActiveBlueprint(null);

    // Simulate LLM + Backend compilation delay
    setTimeout(() => {
      setActiveBlueprint(fixtureToLoad);
      setIsGenerating(false);
    }, 2000);
  }

  return (
    <div className="page">
      {/* Aurora Background */}
      <div className="aurora-bg" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Nav */}
      <nav className="nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <DiwaanSeal size="small" />
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
          <span className="nav-badge">AI Business Intelligence</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="dot" />
          Powered by Gemini AI
        </div>
        <h1 className="hero-title">
          <span className="glow-text">Your Business.</span>
          <br />
          Instantly Visualized.
        </h1>
        <p className="hero-subtitle">
          Describe your business in plain language. Diwaan's AI brain analyzes your
          industry, generates a custom dashboard blueprint, and renders your
          intelligence platform — in seconds.
        </p>

        {/* Prompt Card */}
        <div className="glass-card prompt-card" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span className="prompt-label">Compile UI from natural language</span>
          <div className="prompt-input-wrapper">
            <textarea
              id="business-prompt"
              className="prompt-textarea"
              rows={3}
              placeholder="e.g. I run a cycle manufacturing unit in Kanpur with 15 workers..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />
          </div>
          <div className="prompt-actions">
            <div className="prompt-chips">
              {EXAMPLE_PROMPTS.map(ex => (
                <button key={ex.text} className="chip" onClick={() => handleChip(ex.text)}>
                  {ex.text}
                </button>
              ))}
            </div>
            <button id="generate-btn" className="btn-generate" onClick={handleGenerate}>
              {isGenerating ? 'Compiling...' : 'Generate Dashboard'}
              {!isGenerating && <span className="btn-icon">→</span>}
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard Area */}
      <section className="dashboard-section" id="dashboard-target">
        {isGenerating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', gap: '32px' }}>
            <DiwaanSeal state="generating" size="large" />
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--brushed-gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Parsing Blueprint Parameters...
            </div>
          </div>
        ) : activeBlueprint ? (
          <>
            <p className="section-label">Live Preview — {activeBlueprint.archetype.replace('_', ' ')} Dashboard</p>
            <BlueprintRenderer blueprint={activeBlueprint} />
          </>
        ) : null}
      </section>
    </div>
  );
}

export default LandingPage;
