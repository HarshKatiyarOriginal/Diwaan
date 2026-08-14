import { useState, useEffect } from 'react';

export default function MetricCard({ title, value, delta, unit, sparklineData = [], effectClassName = '' }) {
    const isUp = delta && delta.startsWith('+');
    const isDown = delta && delta.startsWith('-');
    
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        setDisplayValue(value); // reset on value change
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;

        // Parse number from string (e.g. "₹48,200" -> 48200)
        const numericMatch = value.match(/[\d,.]+/);
        if (!numericMatch) return;
        
        const numStr = numericMatch[0].replace(/,/g, '');
        const targetNum = parseFloat(numStr);
        if (isNaN(targetNum)) return;

        const prefix = value.substring(0, numericMatch.index);
        const suffix = value.substring(numericMatch.index + numericMatch[0].length);
        
        const duration = 1000;
        const steps = 30;
        const stepTime = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            // easeOutQuart
            const easeProgress = 1 - Math.pow(1 - progress, 4);
            const currentNum = targetNum * easeProgress;
            
            let formattedNum = currentNum.toLocaleString(undefined, { maximumFractionDigits: targetNum % 1 === 0 ? 0 : 2 });
            setDisplayValue(`${prefix}${formattedNum}${suffix}`);
            
            if (currentStep >= steps) {
                clearInterval(timer);
                setDisplayValue(value);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <div className={`glass-card component-wrapper ${effectClassName}`}>
            <div className="panel-header">
                <span className="panel-title">{title}</span>
            </div>
            <div className="metric-body" style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <span className="metric-big glow-text">{displayValue}</span>
                {unit && <span className="metric-label">{unit}</span>}
            </div>
            {delta && (
                <div className={`metric-delta ${isUp ? 'up' : isDown ? 'down' : ''}`} style={{ marginTop: '8px', fontSize: '0.85rem' }}>
                    {delta} from previous
                </div>
            )}
            {sparklineData.length > 0 && (
                <div className="mini-bars" style={{ marginTop: '16px', display: 'flex', gap: '4px', height: '30px', alignItems: 'flex-end' }}>
                    {sparklineData.map((val, i) => {
                        const max = Math.max(...sparklineData);
                        const pct = (val / max) * 100;
                        return (
                            <div key={i} className="mini-bar" style={{ 
                                height: `${pct}%`, 
                                width: '6px', 
                                background: 'var(--brushed-gold)', 
                                borderRadius: '2px',
                                transition: 'var(--transition-smooth)',
                                animationDelay: `${i * 0.08}s` 
                            }} />
                        );
                    })}
                </div>
            )}
        </div>
    );
}
