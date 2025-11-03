import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import './Artisti.css';
import { useI18n } from '../i18n';

export default function Privacy() {
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
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>{t('privacy_title')}</h1>
        <div className="detail-panel" style={{ marginTop: 12 }}>
          <div className="bio-box" style={{ color: '#fff' }}>
            <p>{t('privacy_p1')}</p>
            <p>{t('privacy_p2').replace('Contatti', '')}<Link to="/contatti">{t('nav_contacts')}</Link>.</p>
            <p>{t('privacy_p3')}</p>
            <p>{t('privacy_p4')}</p>
            <p>{t('privacy_p5')}</p>
            <p>{t('privacy_p6')}</p>
            <p>{t('privacy_p7')}</p>
            <p>{t('privacy_p8')}</p>
          </div>
        </div>
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      <Footer />
    </div>
  );
}
