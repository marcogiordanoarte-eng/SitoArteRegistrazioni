import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from '../i18n';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import "./Artisti.css";
import { db } from '../services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import NavBar from './NavBar';
import LogoPrompt from './LogoPrompt';
import LanguageSwitchBadge from './LanguageSwitchBadge';

export default function PublicSite() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const promoRef = useRef(null);
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  const [logoVideoUrl, setLogoVideoUrl] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlaySource, setOverlaySource] = useState(null); // 'studio' | 'logo'
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });
  // Nessuna intro vocale o AI: rimosso su richiesta

  // Carica homeVideoUrl e studioVideoUrl da Firestore (real-time)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
  setHomeVideoUrl(data?.homeVideoUrl || '');
  setStudioVideoUrl(data?.studioVideoUrl || '');
  setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => unsub();
  }, []);

  // Overlay fullscreen logic
  // Quando si apre l'overlay, metti in pausa il video principale e forzalo in mute
  const openLogoOverlay = () => {
    try {
      if (promoRef.current) {
        promoRef.current.pause();
        promoRef.current.muted = true; // forza mute
        promoRef.current.volume = 0;
      }
    } catch {}
    setOverlaySource('logo');
    setShowOverlay(true);
    if (!logoDismissed) {
      try { localStorage.setItem('ar_logo_clicked','1'); } catch {}
      setLogoDismissed(true);
    }
  };
  const openStudioOverlay = () => {
    try {
      if (promoRef.current) {
        promoRef.current.pause();
        promoRef.current.muted = true;
        promoRef.current.volume = 0;
      }
    } catch {}
    setOverlaySource('studio');
    setShowOverlay(true);
  };
  // Quando si chiude l'overlay, riattiva il video principale ma lascia sempre in mute
  const closeOverlay = () => {
  setShowOverlay(false);
  setOverlaySource(null);
    setTimeout(() => {
      try {
        if (promoRef.current) {
          promoRef.current.muted = true; // audio resta OFF
          promoRef.current.volume = 0;
          promoRef.current.play();
        }
      } catch {}
    }, 300);
  };

  // Accessibilità: attiva overlay con tastiera (Enter/Space)
  const handleLogoKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLogoOverlay();
    }
  };

  return (
    <>
  <Link to="/login" className="dash-badge" title="Dashboard">Dashboard</Link>
  <LanguageSwitchBadge />
      <div className="publicsite-bg page-home">
    {/* DISCO ANIMATO SOTTO LE FRECCE */}
        <div
      className="logo-wrapper"
      style={{ cursor: 'pointer', margin: '18px 0 0 0', position:'relative' }}
      onClick={openLogoOverlay}
      onKeyDown={handleLogoKeyDown}
      role="button"
      tabIndex={0}
  aria-label={t('ps_open_logo_video')}
  title="Logo Video"
    >
  <LogoPrompt show={!showOverlay} text={t('ps_press')} position="bottom" />
          <div className="logo-combo">
            <div className="logo-stack" aria-hidden="true">
              <img src="/disco.png" alt="Disco" className="disco-img" />
              <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
            </div>
            <div className="sounds-app" aria-hidden="true">
              <img src="/soundslogo.jpg" alt="Logo Sounds" className="sounds-app-img" />
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
            ref={promoRef}
            src={homeVideoUrl || "/monitor-default.mp4"}
            autoPlay
            controls
            loop
            muted
            playsInline
            style={{ maxWidth: "92vw", maxHeight: "72vh", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", marginBottom: 12 }}
          />
          <BrandButton onClick={openStudioOverlay} />
        </div>
        {/* Overlay fullscreen solo per video studio */}
        <FullscreenVideoOverlay
          show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
          src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
          onClose={closeOverlay}
          attemptUnmuted
          objectFit="cover"
          controls
        />
  <h1 className="publicsite-title">{t('ps_welcome_title')}</h1>
        <p className="publicsite-desc">
          {t('ps_welcome_desc_line1')}<br />
          {t('ps_welcome_desc_line2')}
        </p>
        <div className="youtube-under-menu">
          <YouTubeButton small layout="row" />
        </div>
  <Footer showArteButton={false} />
    {/* Widget AI globale già montato in App.js */}
      </div>
    </>
  );
}