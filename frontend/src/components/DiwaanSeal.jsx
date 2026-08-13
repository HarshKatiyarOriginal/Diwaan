import './DiwaanSeal.css';

export default function DiwaanSeal({ state = 'static', size = 'large' }) {
    // state: 'static' | 'generating' | 'unlocking'
    
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
