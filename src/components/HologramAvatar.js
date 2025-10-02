import React from 'react';

/**
 * HologramAvatar (Face-only)
 * Versione solo viso con occhi animati e bocca dinamica.
 */
export default function HologramAvatar({ size = 72, speaking = false, listening = false, onClick }) {
  const stateClass = speaking ? 'holo-speaking' : listening ? 'holo-listening' : '';
  return (
    <div className={`holo-avatar face-only ${stateClass}`} style={{ width: size, height: size }} onClick={onClick} role="button" aria-label="Assistente AI" tabIndex={0} onKeyDown={e=>{ if(e.key==='Enter') onClick && onClick(); }}>
      <style>{`
        .holo-avatar { position:relative; cursor:pointer; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .holo-avatar::before, .holo-avatar::after { content:''; position:absolute; inset:0; border-radius:50%; }
        .holo-avatar::before { background: radial-gradient(circle at 50% 52%, rgba(0,255,234,0.55), rgba(0,140,175,0.25), rgba(0,55,80,0)); filter: blur(1.5px); }
        .holo-avatar::after { background: radial-gradient(circle at 50% 50%, rgba(0,220,255,0.25), rgba(0,160,220,0.08), rgba(0,0,0,0)); mix-blend-mode: screen; opacity:.4; }
        .holo-rings { position:absolute; inset:-10px; border-radius:50%; box-shadow:0 0 16px 4px rgba(0,224,255,0.6),0 0 36px 12px rgba(0,160,255,0.28); animation: ring-pulse 3.4s ease-in-out infinite; }
        @keyframes ring-pulse { 0%,100% { transform:scale(1); opacity:.9;} 50% { transform:scale(1.07); opacity:.55;} }
        .holo-speaking .holo-rings { animation: speak-pulse 1.25s ease-in-out infinite; box-shadow:0 0 22px 6px rgba(0,255,205,0.85),0 0 48px 18px rgba(0,180,255,0.55); }
        @keyframes speak-pulse { 0%,100% { transform:scale(1);} 50% { transform:scale(1.15);} }
        .holo-listening .holo-rings { animation: listen-wave 1.2s ease-in-out infinite; box-shadow:0 0 20px 5px rgba(0,180,255,0.85),0 0 44px 16px rgba(0,120,255,0.5); }
        @keyframes listen-wave { 0%,100% { transform:scale(1);} 50% { transform:scale(1.1);} }
        .holo-face { position:absolute; width:88%; height:88%; display:flex; align-items:center; justify-content:center; }
        .holo-face svg { width:100%; height:100%; filter: drop-shadow(0 0 5px #33e9ff) drop-shadow(0 0 14px #28b8ff); stroke:#c9faff; stroke-width:1.5; }
        /* Occhi nuovi (solo due) */
        .eye-group { animation: blink 6s infinite; transform-origin:center; }
        @keyframes blink { 0%,4%,6%,100% { transform:scaleY(1);} 5% { transform:scaleY(0.1);} }
        .pupil { fill:#c9faff; animation: pupil-glow 3s ease-in-out infinite; }
        @keyframes pupil-glow { 0%,100% { opacity:1;} 50% { opacity:0.55;} }
        /* Bocca */
        .mouth { stroke-linecap:round; stroke-width:2; }
        .holo-speaking .mouth { animation: mouth-talk 0.36s ease-in-out infinite; }
        @keyframes mouth-talk { 0%,100% { d: path('M36 63 Q50 70 64 63'); } 50% { d: path('M36 63 Q50 76 64 63'); } }
        /* Cuffie ridisegnate */
        .band { stroke-width:3; stroke-linecap:round; }
        .earpad { stroke-width:2.2; }
        .ear-grid line { stroke-width:0.9; opacity:0.75; }
        /* Equalizer semplificato */
        .eq { stroke:#5fffd4; stroke-width:2; stroke-linecap:round; animation: eq-pulse 1.1s ease-in-out infinite; transform-origin:center bottom; }
        .eq.b { animation-delay:.25s; }
        .eq.c { animation-delay:.5s; }
        @keyframes eq-pulse { 0%,100% { transform:scaleY(.5);} 50% { transform:scaleY(1);} }
        .holo-speaking .holo-face svg { filter: drop-shadow(0 0 9px #5fffd4) drop-shadow(0 0 20px #35d6ff); }
      `}</style>
      <div className="holo-rings" />
      <div className="holo-face">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {/* Testa */}
          <path d="M28 46 Q28 16 50 8 Q72 16 72 46 Q72 70 50 80 Q28 70 28 46 Z" fill="none" />
          {/* Capelli / arco */}
          <path d="M28 44 Q50 0 72 44" fill="none" strokeDasharray="5 4" />
          {/* Cuffie: band */}
          <path className="band" d="M30 38 Q50 20 70 38" />
          {/* Earpads rettangolari arrotondati */}
          <rect className="earpad" x="21" y="44" width="10" height="16" rx="3" ry="3" fill="none" />
          <rect className="earpad" x="69" y="44" width="10" height="16" rx="3" ry="3" fill="none" />
          {/* Griglia altoparlante sinistra */}
          <g className="ear-grid" stroke="#9defff">
            <line x1="23" y1="47" x2="29" y2="47" />
            <line x1="23" y1="51" x2="29" y2="51" />
            <line x1="23" y1="55" x2="29" y2="55" />
          </g>
          {/* Griglia altoparlante destra */}
          <g className="ear-grid" stroke="#9defff">
            <line x1="71" y1="47" x2="77" y2="47" />
            <line x1="71" y1="51" x2="77" y2="51" />
            <line x1="71" y1="55" x2="77" y2="55" />
          </g>
          {/* Occhi (arc + pupil) */}
          <g className="eye-group">
            <path d="M36 50 Q44 44 50 50" fill="none" />
            <circle className="pupil" cx="43" cy="49" r="2.2" />
            <path d="M50 50 Q56 44 64 50" fill="none" />
            <circle className="pupil" cx="57" cy="49" r="2.2" />
          </g>
          {/* Bocca */}
          <path className="mouth" d="M36 63 Q50 70 64 63" />
          {/* Mini equalizer in basso */}
          <g transform="translate(50 86) scale(.8 1)">
            <line className="eq a" x1="-8" y1="-5" x2="-8" y2="5" />
            <line className="eq b" x1="0" y1="-8" x2="0" y2="8" />
            <line className="eq c" x1="8" y1="-6" x2="8" y2="6" />
          </g>
        </svg>
      </div>
    </div>
  );
}
