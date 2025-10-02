import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import './Artisti.css';

export default function Licenza() {
  const navigate = useNavigate();
  return (
    <div className="publicsite-bg">
      <Link to="/login" className="dash-badge">Dashboard</Link>
      <button onClick={() => navigate(-1)} aria-label="Torna indietro" style={{ position: 'fixed', top: 10, left: 10, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '2px solid #ffd700', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 12px rgba(255,215,0,0.6)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="logo-wrapper">
        <div className="logo-stack">
            <img src="/disco.png" alt="Disco" className="disco-img" />
            <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <NavBar />
  

      <div className="container" style={{ maxWidth: 900, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>Licenza d’uso e Recesso</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p><strong>Licenza d’uso</strong>: con l’acquisto ottieni una licenza non esclusiva, non trasferibile, per utilizzare il brano in contenuti video, social, podcast e progetti multimediali. Non è consentita la rivendita o redistribuzione del file audio come brano singolo.</p>
            <p><strong>Ambito</strong>: la licenza copre usi online e multimediali standard. Per utilizzi broadcast/advertising o tirature elevate, contattaci per una licenza personalizzata.</p>
            <p><strong>Recesso</strong>: per i contenuti digitali, una volta iniziato il download/streaming, il diritto di recesso non si applica (art. 59 Codice del Consumo).</p>
            <p>Per domande sulla licenza o necessità specifiche, scrivici dalla pagina <Link to="/contatti">Contatti</Link>.</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
