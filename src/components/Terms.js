import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import YouTubeButton from './YouTubeButton';
import NavBar from './NavBar';
import Footer from './Footer';
import './Artisti.css';
import { useI18n } from '../i18n';

export default function Terms() {
  const { t } = useI18n();
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
        aria-label={t('ps_back')}
        title={t('ps_back')}
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
    <NavBar />

      <div className="container" style={{ maxWidth: 900, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>{t('terms_title')}</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p>{t('terms_p1')}</p>
            <p>{t('terms_p2')}</p>
            <p>{t('terms_p3')}</p>
            <p>{t('terms_p4')}</p>
            <p>{t('terms_p5').replace('Licenza', '')}<Link to="/licenza">{t('footer_license')}</Link>.</p>
            <p>{t('terms_p6')}</p>
            <p>{t('terms_p7').replace('Contatti', '')}<Link to="/contatti">{t('nav_contacts')}</Link>.</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
