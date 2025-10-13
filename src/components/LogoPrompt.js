import React, { useEffect, useState, useRef } from 'react';

/**
 * LogoPrompt
 * Visual hint (animated arrows + label) encouraging the user to click/tap the logo.
 * Props:
 *  - show: boolean (se false disattiva completamente il ciclo e nasconde il prompt)
 *  - text: string (default 'Premi')
 *  - accent: color accent (default '#ffd700')
 *  - position: 'top' | 'bottom' (default 'top')
 *  - loop: boolean (default true) se true riappare ciclicamente
 *  - cycleMs: numero ms dell'intero ciclo (default 25000)
 *  - showDurationMs: ms di visibilità in ogni ciclo (default 5500)
 *  - initialDelayMs: ritardo prima della prima apparizione (default 0)
 */
export default function LogoPrompt({
  show,
  text = 'Premi',
  accent = '#ffd700',
  position = 'top',
  loop = true,
  cycleMs = 25000,
  showDurationMs = 5500,
  initialDelayMs = 0
}) {
  const [visible, setVisible] = useState(false);
  const timersRef = useRef([]);

  useEffect(() => {
    // cleanup timers
    return () => { timersRef.current.forEach(t => clearTimeout(t)); timersRef.current = []; };
  }, []);

  useEffect(() => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    if (!show) { setVisible(false); return; }

    const safeShowDuration = Math.min(showDurationMs, cycleMs - 500);
    const start = () => {
      setVisible(true);
      // hide after showDuration
      timersRef.current.push(setTimeout(() => {
        setVisible(false);
        if (loop) {
          // next cycle start
          const rest = cycleMs - safeShowDuration;
            timersRef.current.push(setTimeout(start, rest));
        }
      }, safeShowDuration));
    };
    timersRef.current.push(setTimeout(start, initialDelayMs));
  }, [show, loop, cycleMs, showDurationMs, initialDelayMs]);

  if (!visible) return null;

  const posStyle = position === 'top' ? { top: '-86px' } : { bottom: '-44px' };
  return (
    <div className="logo-prompt" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none', zIndex: 100, ...posStyle }}>
      <style>{`
        @keyframes lp-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes lp-pulse { 0%,100% { box-shadow: 0 0 6px ${accent}, 0 0 18px rgba(255,215,0,0.3); } 50% { box-shadow: 0 0 14px ${accent}, 0 0 28px rgba(255,215,0,0.55); } }
        .logo-prompt .lp-badge { font-size: 0.82rem; letter-spacing: 1px; font-weight: 800; padding: 7px 16px; border-radius: 18px; background: linear-gradient(145deg, rgba(0,0,0,0.7), rgba(0,0,0,0.25)); border:1px solid ${accent}; color: ${accent}; text-transform: uppercase; animation: lp-pulse 2.2s ease-in-out infinite; backdrop-filter: blur(4px); opacity: 0; animation: lp-pulse 2.2s ease-in-out infinite; transition: opacity .6s ease; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
        .logo-prompt .lp-chevrons { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .logo-prompt svg { width: 26px; height: 26px; stroke: #ffffff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; fill: none; filter: drop-shadow(0 0 8px rgba(255,215,0,0.65)) drop-shadow(0 0 4px rgba(255,255,255,0.9)); animation: lp-bounce 1.6s infinite; }
        .logo-prompt svg:nth-child(2) { animation-delay: .25s; }
        .logo-prompt svg:nth-child(3) { animation-delay: .5s; }
        .logo-prompt { animation: lp-fadeIn .5s forwards; }
        @keyframes lp-fadeIn { from { opacity:0; } to { opacity:1; } }
        @media (max-width:600px){ .logo-prompt .lp-badge { font-size: 0.74rem; padding:6px 12px; } .logo-prompt svg { width:22px; height:22px; } }
      `}</style>
      {position === 'top' && (
        <div className="lp-chevrons" aria-hidden="true">
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      )}
      <div className="lp-badge" aria-label="Suggerimento: premi il logo" style={{ opacity: 1 }}>{text}</div>
      {position === 'bottom' && (
        <div className="lp-chevrons" aria-hidden="true" style={{ transform: 'rotate(180deg)' }}>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      )}
    </div>
  );
}
