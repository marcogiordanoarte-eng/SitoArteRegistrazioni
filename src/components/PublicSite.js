import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from '../i18n';
import SocialMinimal from './SocialMinimal';
import Footer from './Footer';
import BrandButton from './BrandButton';
import "./Artisti.css";
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import NavBar from './NavBar';

export default function PublicSite() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  // Nessuna intro vocale o AI: rimosso su richiesta

  // Carica homeVideoUrl da Firestore (real-time)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
  setHomeVideoUrl(data?.homeVideoUrl || '');
    });
    return () => unsub();
  }, []);

  return (
    <>
      <style>{`
        .btn-enter-green {
          display:inline-block;
          padding: 10px 16px;
          border: 1px solid #00FF00;
          color: #00FF00;
          background: rgba(0,0,0,0.35);
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          letter-spacing: 0.3px;
          text-shadow: 0 0 10px rgba(0,255,0,0.65);
          box-shadow: 0 0 0 rgba(0,255,0,0.0);
          transition: box-shadow 300ms ease, filter 300ms ease;
        }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 8px rgba(0,255,0,0.35), 0 0 0 rgba(0,255,0,0.0); }
          50% { box-shadow: 0 0 16px rgba(0,255,0,0.75), 0 0 32px rgba(0,255,0,0.25); }
          100% { box-shadow: 0 0 8px rgba(0,255,0,0.35), 0 0 0 rgba(0,255,0,0.0); }
        }
        .btn-enter-green:hover {
          animation: pulseGlow 2.2s ease-in-out infinite;
          filter: brightness(1.05);
        }
      `}</style>
  <Link to="/login" className="dash-badge" title="Dashboard">Dashboard</Link>
      <div className="publicsite-bg page-home">
    {/* DISCO ANIMATO SOTTO LE FRECCE */}
        <div className="logo-wrapper" style={{ margin: '18px 0 0 0', position:'relative' }}>
          <div className="logo-combo">
            <div className="logo-stack" aria-hidden="true">
                <img src="/disco.png" alt="Disco" className="disco-img" />
                <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
              </div>
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
        <div className="container" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", display: "flex", marginBottom: 0 }}>
          {/* Video principale della homepage: parte SEMPRE in mute */}
          <video
            src={homeVideoUrl || "/monitor-default.mp4"}
            autoPlay
            controls
            loop
            muted
            playsInline
            style={{ maxWidth: "92vw", maxHeight: "72vh", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", marginBottom: 12 }}
          />
          <BrandButton onClick={() => navigate('/arte-registrazioni')} />
          <div style={{ marginTop: 10 }}>
            <Link to="/sounds" className="btn-enter-green">Entra ora</Link>
          </div>
        </div>
  <h1 className="publicsite-title">{t('ps_welcome_title')}</h1>
        <p className="publicsite-desc">
          {t('ps_welcome_desc_line1')}<br />
          {t('ps_welcome_desc_line2')}
        </p>
        <SocialMinimal />
  <Footer showArteButton={false} />
    {/* Widget AI globale già montato in App.js */}
      </div>
    </>
  );
}