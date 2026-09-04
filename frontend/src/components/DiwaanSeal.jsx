import { useState } from 'react';
import './DiwaanSeal.css';
import ThreeDiwaanSeal from './ThreeDiwaanSeal';

export default function DiwaanSeal({ state = 'static', size = 'large' }) {
  const [webglFailed, setWebglFailed] = useState(false);

  // Render 3D WebGL centerpiece for large size when WebGL is available
  if (size === 'large' && !webglFailed) {
    return (
      <ThreeDiwaanSeal
        state={state}
        onError={() => setWebglFailed(true)}
      />
    );
  }

  // CSS Ring version for small size or WebGL fallback
  return (
    <div className={`diwaan-seal-container ${state} size-${size}`}>
      <div className="seal-ring outer"></div>
      <div className="seal-ring middle"></div>
      <div className="seal-core">
        <div className="core-glow"></div>
        <div className="core-symbol">♦</div>
      </div>
    </div>
  );
}
