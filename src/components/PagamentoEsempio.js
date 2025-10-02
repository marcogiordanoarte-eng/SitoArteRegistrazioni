import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import './Artisti.css';

export default function PagamentoEsempio() {
  const navigate = useNavigate();
  const go = (url) => {
    try { window.location.assign(url); } catch { try { window.location.href = url; } catch {} }
  };
  const PP_1_99 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=5CGE5SB2DM2G2';
  const PP_9_99 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=P7FKWUEHQGCFE';
  const PP_100 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=49B6QFGV44SP4';
  return (
    <div className="publicsite-bg">
      <Link to="/login" className="dash-badge">Dashboard</Link>
      <div className="logo-wrapper">
        <div className="logo-stack">
            <img src="/disco.png" alt="Disco" className="disco-img" />
            <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <NavBar />
      

      <div className="container" style={{ maxWidth: 900, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>Esempio Pagamento</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p>Questa pagina dimostra un flusso di pagamento funzionante come richiesto da Stripe.</p>
            <ul>
              <li>Prodotto digitale: brani musicali royalty‑free</li>
              <li>Prezzi visibili prima dell’acquisto e per ciascun brano</li>
              <li>Acquisto: bottone PayPal (temporaneo) o Stripe Payment Links</li>
              <li>Consegna: download immediato post‑pagamento</li>
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              <button type="button" className="glow-btn" onClick={() => go(PP_1_99)}>Compra esempio € 1,99</button>
              <button type="button" className="glow-btn" onClick={() => go(PP_9_99)}>Compra esempio € 9,99</button>
              <button type="button" className="glow-btn" onClick={() => go(PP_100)}>Compra esempio € 100,00</button>
            </div>
            <p style={{ marginTop: 14, opacity: 0.95 }}>Per i termini di licenza e recesso consulta <Link to="/licenza">questa pagina</Link>. Per assistenza, visita <Link to="/contatti">Contatti</Link>.</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
