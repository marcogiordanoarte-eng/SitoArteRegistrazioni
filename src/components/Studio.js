import React from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import LogoPrompt from './LogoPrompt';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import "./Artisti.css";

export default function Studio() {
  const navigate = useNavigate();
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = React.useState('');
  const [logoVideoUrl, setLogoVideoUrl] = React.useState('');
  const [overlaySource, setOverlaySource] = React.useState(null); // 'studio' | 'logo'
  const promoRef = React.useRef(null);
  const [logoDismissed, setLogoDismissed] = React.useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });

  React.useEffect(() => {
    const unsubStudio = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setStudioVideoUrl(data?.studioVideoUrl || '');
      setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => unsubStudio();
  }, []);

  // Overlay logic: pausa/riattiva video presentazione
  const openOverlay = (source = 'studio') => {
    try {
      if (promoRef.current) {
        promoRef.current.pause();
        promoRef.current.muted = true;
        promoRef.current.volume = 0;
      }
    } catch (e) {}
    setOverlaySource(source);
    setShowOverlay(true);
  };
  const closeOverlay = () => {
    setShowOverlay(false);
    setOverlaySource(null);
    setTimeout(() => {
      try {
        if (promoRef.current) {
          promoRef.current.muted = true;
          promoRef.current.volume = 0;
          promoRef.current.play();
        }
      } catch (e) {}
    }, 300);
  };

  return (
    <div className="publicsite-bg page-studio">
      <Link to="/login" className="dash-badge">Dashboard</Link>
      <button onClick={() => navigate(-1)} aria-label="Torna indietro" style={{ position: 'fixed', top: 10, left: 10, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '2px solid #ffd700', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 12px rgba(255,215,0,0.6)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <div className="logo-wrapper" style={{ cursor:'pointer', position:'relative' }} onClick={() => { if(!logoDismissed){ try { localStorage.setItem('ar_logo_clicked','1'); } catch {}; setLogoDismissed(true);} openOverlay('logo'); }} title="Video Logo">
        <LogoPrompt show={!showOverlay && !logoDismissed} text="Premi" position="top" />
        <div className="logo-stack">
            <img src="/disco.png" alt="Disco" className="disco-img" />
            <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <NavBar />
      <div className="container studio-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <button type="button" className="studio-btn" aria-label="Arte Studio a schermo intero" onClick={() => openOverlay('studio')}>
          <img src="/artestudio.jpg" alt="Arte Studio a schermo intero" ref={promoRef} />
        </button>
      </div>
      <FullscreenVideoOverlay
        show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
        src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
        onClose={closeOverlay}
        attemptUnmuted
      />
      <div className="youtube-under-menu">
        <YouTubeButton small layout="row" />
      </div>
      <div style={{ marginTop: 12, display:'flex', justifyContent:'center' }}>
        <BrandButton onClick={() => openOverlay('studio')} />
      </div>
  <Footer showArteButton={false} />
    </div>
  );
}
