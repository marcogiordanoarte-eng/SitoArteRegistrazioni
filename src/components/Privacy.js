import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import './Artisti.css';

export default function Privacy() {
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
        style={{
          position:'fixed', top:'12px', left:'12px', zIndex:100002,
          background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%',
            width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000'
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <NavBar />
  

      <div className="container" style={{ maxWidth: 900, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>Privacy Policy</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p>Questa informativa illustra come trattiamo i dati personali degli utenti che acquistano o interagiscono con il sito di Arte Registrazioni.</p>
            <p><strong>Titolare</strong>: Arte Registrazioni — Partita IVA 12531290018 — contatti sulla pagina <Link to="/contatti">Contatti</Link>.</p>
            <p><strong>Dati trattati</strong>: dati di contatto forniti dall’utente (es. email), dati tecnici anonimi di navigazione, ed eventuali dati di pagamento gestiti da provider terzi (Stripe, PayPal) su propri sistemi.</p>
            <p><strong>Finalità</strong>: evasione degli ordini, assistenza clienti, adempimenti contabili e di legge, sicurezza e prevenzione abusi.</p>
            <p><strong>Base giuridica</strong>: esecuzione di un contratto e adempimenti legali; legittimo interesse per sicurezza/frode; consenso ove richiesto.</p>
            <p><strong>Conservazione</strong>: per il tempo necessario all’erogazione del servizio e adempimenti di legge.</p>
            <p><strong>Diritti</strong>: accesso, rettifica, cancellazione, limitazione, opposizione, portabilità nei limiti di legge; per esercitarli contattaci.</p>
            <p><strong>Cookie/terze parti</strong>: strumenti di terzi possono impostare cookie tecnici/di funzionalità. Le pagine di pagamento Stripe sono gestite da Stripe.</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
