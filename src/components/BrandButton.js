import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * BrandButton: unico pulsante "Arte Registrazioni" da usare su tutte le pagine.
 * Props:
 *  - onClick (opzionale): azione custom (es: apri overlay video studio). Se assente naviga a "/".
 *  - size: 'md' | 'lg' (default 'lg')
 *  - style: override inline styles
 */
export default function BrandButton({ onClick, size = 'lg', style }) {
  const navigate = useNavigate();
  const base = {
    '--brand-glow': '0 0 14px #00c6ff, 0 0 34px #0094ff7d, 0 0 68px #00e0ff40',
    background: 'linear-gradient(135deg,#004b92 0%,#008dff 55%,#00e0ff 100%)',
    color: '#ffffff',
    fontFamily: 'Vintaface-Regular, Georgia, serif',
    fontWeight: 800,
    letterSpacing: '0.5px',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 18,
    padding: size === 'md' ? '10px 26px' : '14px 38px',
    fontSize: size === 'md' ? '1.05rem' : '1.35rem',
    textShadow: '0 0 6px rgba(0,224,255,0.75), 0 0 12px rgba(0,140,255,0.55)',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 14px rgba(0,0,0,0.65), 0 0 18px #00bbff, 0 0 42px rgba(0,208,255,0.55)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    lineHeight: 1.1,
    textDecoration: 'none',
    transition: 'box-shadow .35s ease, transform .25s ease, filter .35s ease',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)'
  };
  const handle = (e) => {
    if (onClick) onClick(e); else navigate('/');
  };
  return (
    <button
      className="brand-btn"
      onClick={handle}
      aria-label="Arte Registrazioni"
      style={Object.assign({}, base, style)}
      onMouseEnter={(e)=>{ e.currentTarget.style.boxShadow='0 0 0 1px rgba(255,255,255,0.12), 0 6px 20px rgba(0,0,0,0.7), 0 0 26px #00e0ff, 0 0 70px rgba(0,200,255,0.65)'; e.currentTarget.style.transform='translateY(-2px) scale(1.03)'; }}
      onMouseLeave={(e)=>{ e.currentTarget.style.boxShadow=base.boxShadow; e.currentTarget.style.transform='none'; }}
      onFocus={(e)=>{ e.currentTarget.style.boxShadow='0 0 0 2px #ffffff55, 0 0 32px #00d8ff, 0 0 70px rgba(0,200,255,0.75)'; }}
      onBlur={(e)=>{ e.currentTarget.style.boxShadow=base.boxShadow; }}
    >
      <span style={{ filter:'drop-shadow(0 0 4px #00d8ff)' }}>Arte Registrazioni</span>
    </button>
  );
}
