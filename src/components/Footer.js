import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer({ align = 'center', showArteButton = false, onArteClick }) {
  const year = new Date().getFullYear();
  return (
    <footer
      id="site-footer"
      className="site-footer"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: align,
        gap: 12,
        padding: '16px 12px',
        marginTop: 24,
        borderTop: '1px solid rgba(255,215,0,0.3)',
        background: 'rgba(0,0,0,0.55)'
      }}
    >
      {showArteButton && (
        <button className="glow-btn" style={{ fontSize: "1.2rem", padding: "10px 28px", marginBottom: 8, border: 'none', background: 'inherit', cursor: 'pointer' }} onClick={onArteClick}>
          <h1 style={{ fontSize: "1.1em", margin: 0 }}>Arte Registrazioni</h1>
        </button>
      )}
      {/* Pulsante grande Musica sempre visibile */}
      <Link to="/musica" className="glow-btn" style={{ fontSize: "1.3rem", padding: "14px 38px", margin: "12px 0", background: '#ffd700', color: '#222', fontWeight: 700, borderRadius: 14, textDecoration: 'none', boxShadow: '0 0 16px #ffd700', border: 'none', cursor: 'pointer' }}>
        🎵 Musica
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src="/logo.png"
          alt="Logo Arte Registrazioni"
          style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 2px #ffd700)' }}
        />
        <div
          style={{
            color: '#ffd700',
            fontSize: '0.95rem',
            textAlign: align,
            lineHeight: 1.4
          }}
        >
          © {year} Arte Registrazioni - <a href="https://www.arteregistrazioni.com" target="_blank" rel="noopener noreferrer" style={{ color: '#ffd700', textDecoration: 'underline' }}>www.arteregistrazioni.com</a> - Marco Giordano - Partita IVA: 12531290018
          <span style={{ marginLeft: 12 }}>
            <Link to="/termini" className="footer-link">Termini</Link>
            <span style={{ margin: '0 6px', opacity: 0.6 }}>|</span>
            <Link to="/privacy" className="footer-link">Privacy</Link>
            <span style={{ margin: '0 6px', opacity: 0.6 }}>|</span>
            <Link to="/licenza" className="footer-link">Licenza</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
