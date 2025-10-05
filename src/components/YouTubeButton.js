import React from 'react';

// Pulsanti social: ora supporta layout in colonna (default) o in riga (row)
export default function YouTubeButton({ layout = 'column', style = {}, gap: gapProp }) {
  // Lasciamo a CSS la gestione delle dimensioni delle icone;
  // qui gestiamo solo il layout (row/column) e lo spacing opzionale.
  const wrap = {
    display: 'flex',
    flexDirection: layout === 'row' ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: gapProp ?? (layout === 'row' ? 24 : 10),
    width: '100%',
    ...style,
  };

  return (
    <div style={wrap} className="social-bar">
      <a
        href="https://www.facebook.com/arteregistrazionilabel/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri Facebook"
        className="social-btn social-btn--fb"
      >
        <img src="/icons/facebook.png" alt="Facebook" />
        <span className="social-label">Facebook</span>
      </a>

      <a
        href="https://www.youtube.com/@arteregistrazioni"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri YouTube"
        className="social-btn social-btn--yt"
      >
        <img src="/icons/youtube.png" alt="YouTube" />
        <span className="social-label">YouTube</span>
      </a>

      <a
        href="https://www.instagram.com/arte.registrazioni/"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Apri Instagram"
        className="social-btn social-btn--ig"
      >
        <img src="/icons/instagram.png" alt="Instagram" />
        <span className="social-label">Instagram</span>
      </a>
    </div>
  );
}
