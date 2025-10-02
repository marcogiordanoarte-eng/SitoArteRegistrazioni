import React from 'react';

// Pulsanti social: ora supporta layout in colonna (default) o in riga (row)
export default function YouTubeButton({ small = false, layout = 'column', style = {} }) {
  // Dimensioni elevate per massima leggibilità su mobile
  const gap = layout === 'row' ? (small ? 10 : 14) : (small ? 18 : 26);
  const height = layout === 'row' ? (small ? 44 : 52) : (small ? 68 : 88);
  const fontSize = layout === 'row' ? (small ? 13 : 15) : (small ? 18 : 22);
  const icon = layout === 'row' ? (small ? 16 : 20) : (small ? 26 : 32);
  const padX = layout === 'row' ? (small ? 10 : 12) : (small ? 18 : 28);
  const radius = small ? 16 : 20;
  const maxW = small ? 520 : 600;

  const wrap = {
    display: 'flex',
    flexDirection: layout === 'row' ? 'row' : 'column',
    flexWrap: layout === 'row' ? 'nowrap' : 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap,
    width: '100%',
    margin: layout === 'row' ? '10px auto' : '14px auto 2px',
    padding: '0 12px',
    ...style,
  };

  const baseBtn = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height,
  width: layout === 'row' ? 'auto' : 'min(92vw, ' + maxW + 'px)',
  minWidth: layout === 'row' ? (small ? 110 : 128) : undefined,
    padding: `0 ${padX}px`,
    borderRadius: radius,
    textDecoration: 'none',
    fontWeight: 900,
    letterSpacing: 0.3,
    fontSize,
    color: '#fff',
    border: '2px solid rgba(255,255,255,0.15)',
    boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
    textShadow: '0 1px 2px rgba(0,0,0,0.65)',
    transform: 'translateZ(0)',
    willChange: 'transform, box-shadow, filter',
    transition: 'transform 120ms ease, box-shadow 200ms ease, filter 180ms ease',
    WebkitTapHighlightColor: 'transparent',
  };

  const haloBase = {
    position: 'absolute',
    inset: '-20px -24px',
    borderRadius: radius + 10,
    filter: 'blur(16px)',
    opacity: 0.55,
    zIndex: -1,
    pointerEvents: 'none',
  };

  const iconStyle = {
    width: icon,
    height: icon,
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.45))',
  };

  const onDown = (e) => { e.currentTarget.style.transform = 'scale(0.985)'; };
  const onUp = (e) => { e.currentTarget.style.transform = 'scale(1)'; };
  const onLeave = (e) => { e.currentTarget.style.transform = 'scale(1)'; };
  const onEnter = (e) => { e.currentTarget.style.filter = 'brightness(1.03)'; };
  const onOut = (e) => { e.currentTarget.style.filter = 'none'; };

  const fb = {
    background: 'linear-gradient(180deg, #1f88ff 0%, #1877F2 85%)',
    boxShadow: '0 0 34px rgba(24,119,242,0.58), 0 10px 28px rgba(0,0,0,0.55)',
  };
  const fbHalo = { ...haloBase, background: 'radial-gradient(60% 60% at 50% 50%, rgba(24,119,242,0.55), rgba(24,119,242,0.18) 60%, transparent 80%)' };

  const yt = {
    background: 'linear-gradient(180deg, #ff3b2f 0%, #FF0000 85%)',
    boxShadow: '0 0 34px rgba(255,0,0,0.58), 0 10px 28px rgba(0,0,0,0.55)',
  };
  const ytHalo = { ...haloBase, background: 'radial-gradient(60% 60% at 50% 50%, rgba(255,0,0,0.55), rgba(255,0,0,0.18) 60%, transparent 80%)' };

  const ig = {
    background: 'linear-gradient(135deg, #F58529 0%, #DD2A7B 35%, #8134AF 70%, #515BD4 100%)',
    boxShadow: '0 0 34px rgba(221,42,123,0.58), 0 10px 28px rgba(0,0,0,0.55)',
  };
  const igHalo = { ...haloBase, background: 'radial-gradient(60% 60% at 50% 50%, rgba(221,42,123,0.55), rgba(221,42,123,0.18) 60%, transparent 80%)' };

  return (
    <div style={wrap} className="social-bar">
      <a
        href="https://www.facebook.com/arteregistrazionilabel/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri Facebook"
        className="social-btn social-btn--fb"
        style={{ ...baseBtn, ...fb }}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
        onMouseEnter={onEnter}
        onBlur={onOut}
        onTouchStart={onDown}
        onTouchEnd={onUp}
      >
        <span style={fbHalo} />
        <img src="/icons/facebook.png" alt="Facebook" style={iconStyle} />
        <span>Facebook</span>
      </a>

      <a
        href="https://www.youtube.com/@arteregistrazioni"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri YouTube"
        className="social-btn social-btn--yt"
        style={{ ...baseBtn, ...yt }}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
        onMouseEnter={onEnter}
        onBlur={onOut}
        onTouchStart={onDown}
        onTouchEnd={onUp}
      >
        <span style={ytHalo} />
        <img src="/icons/youtube.png" alt="YouTube" style={iconStyle} />
        <span>YouTube</span>
      </a>

      <a
        href="https://www.instagram.com/arte.registrazioni/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri Instagram"
        className="social-btn social-btn--ig"
        style={{ ...baseBtn, ...ig }}
        onMouseDown={onDown}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
        onMouseEnter={onEnter}
        onBlur={onOut}
        onTouchStart={onDown}
        onTouchEnd={onUp}
      >
        <span style={igHalo} />
        <img src="/icons/instagram.png" alt="Instagram" style={iconStyle} />
        <span>Instagram</span>
      </a>
    </div>
  );
}
