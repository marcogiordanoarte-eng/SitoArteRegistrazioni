import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import YouTubeButton from './YouTubeButton';
import NavBar from './NavBar';
import Footer from './Footer';
import './Artisti.css';

export default function Terms() {
  const navigate = useNavigate();
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
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>Termini e Condizioni</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p><strong>Arte Registrazioni</strong> — Partita IVA 12531290018. Vendiamo contenuti musicali digitali e licenze d’uso royalty‑free per progetti multimediali.</p>
            <p><strong>Prodotti e prezzi</strong>: i prezzi sono indicati accanto a ciascun brano nella sezione Buy Music. Gli importi sono mostrati in euro e visibili prima dell’acquisto.</p>
            <p><strong>Acquisto e pagamento</strong>: l’acquisto avviene tramite link di pagamento sicuri (Stripe Payment Links) e, se previsto, con metodi alternativi indicati nella pagina del brano.</p>
            <p><strong>Consegna</strong>: trattandosi di beni digitali, il download è disponibile subito dopo il pagamento o tramite pagina/collegamento inviato all’utente.</p>
            <p><strong>Licenza d’uso</strong>: l’acquisto include una licenza non esclusiva, non trasferibile, per l’utilizzo del brano nei limiti descritti nella pagina <Link to="/licenza">Licenza</Link>.</p>
            <p><strong>Diritto di recesso</strong>: ai sensi della normativa sui contenuti digitali, il recesso non si applica dopo l’inizio del download/streaming del contenuto acquistato.</p>
            <p><strong>Assistenza</strong>: per supporto o fatturazione contattaci dalla pagina <Link to="/contatti">Contatti</Link>.</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
