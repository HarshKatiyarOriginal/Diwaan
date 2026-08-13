import { useState, Suspense, lazy } from 'react';
import './index.css';
import './App.css';
import SpecShield from './SpecShield';
import DiwaanSeal from './components/DiwaanSeal';

// Lazy load the heavy Diwaan module
const LandingPage = lazy(() => import('./LandingPage'));

function App() {
  const [view, setView] = useState('specshield'); // 'specshield' | 'diwaan'
  const [transitioning, setTransitioning] = useState(false);

  function handleLaunchDiwaan() {
    setTransitioning(true);
    setTimeout(() => {
      setView('diwaan');
      setTransitioning(false);
    }, 800); // Wait for unlock animation
  }

  function handleBackToSpecShield() {
    setView('specshield');
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      
      {/* Vault Transition Overlay */}
      {transitioning && (
        <div className="vault-transition-overlay">
          <div className="vault-doors">
            <div className="vault-door left"></div>
            <div className="vault-door right"></div>
          </div>
          <div className="vault-seal-wrapper">
             <DiwaanSeal state="unlocking" size="large" />
          </div>
        </div>
      )}

      {view === 'specshield' ? (
        <SpecShield onLaunchDiwaan={handleLaunchDiwaan} />
      ) : (
        <Suspense fallback={<div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--vault-sapphire)' }}><DiwaanSeal state="generating" size="large" /></div>}>
          <LandingPage onBack={handleBackToSpecShield} />
        </Suspense>
      )}
    </div>
  );
}

export default App;
