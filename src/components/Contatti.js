import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import ContactForm from './ContactForm';
import LogoPrompt from './LogoPrompt';
import AIAssistantWidget from './AIAssistantWidget';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import { getFunctions, httpsCallable } from 'firebase/functions';
import "./Artisti.css";

export default function Contatti() {
  const navigate = useNavigate();
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = React.useState('');
  const [logoVideoUrl, setLogoVideoUrl] = React.useState('');
  const [overlaySource, setOverlaySource] = React.useState(null); // 'studio' | 'logo'
  const overlayVideoRef = useRef(null);
  const [overlayForceMuted, setOverlayForceMuted] = useState(false);
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });
  React.useEffect(() => {
    import('./firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, onSnapshot }) => {
        const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setStudioVideoUrl(data?.studioVideoUrl || '');
          setLogoVideoUrl(data?.logoVideoUrl || '');
        });
        return () => unsub();
      });
    });
  }, []);

  // Autoplay attempt when overlay appears (mobile support)
  useEffect(() => {
    if (showOverlay) {
      setTimeout(() => {
        const v = overlayVideoRef.current; if (!v) return;
        try {
          v.muted = false; v.volume = 1;
          v.play().then(()=> setOverlayForceMuted(false)).catch(()=>{
            try { v.muted = true; v.volume = 0; setOverlayForceMuted(true); v.play().catch(()=>{}); } catch {}
          });
        } catch {}
      }, 40);
    }
  }, [showOverlay, overlaySource]);
  return (
    <div className="publicsite-bg page-contatti">
      <Link to="/login" className="dash-badge">Dashboard</Link>
      <button onClick={() => navigate(-1)} aria-label="Torna indietro" style={{ position: 'fixed', top: 10, left: 10, zIndex: 10000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', border: '2px solid #ffd700', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 12px rgba(255,215,0,0.6)' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
  <div className="logo-wrapper" style={{ cursor: 'pointer', position:'relative' }} onClick={() => { if(!logoDismissed){ try { localStorage.setItem('ar_logo_clicked','1'); } catch {} ; setLogoDismissed(true);} setOverlaySource('logo'); setShowOverlay(true); }} title="Video Logo">
    <LogoPrompt show={!showOverlay && !logoDismissed} text="Premi" position="top" />
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <FullscreenVideoOverlay
        show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
        src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
        onClose={() => setShowOverlay(false)}
        attemptUnmuted
      />
      <NavBar />
      <div className="container contacts-container" style={{ maxWidth: 600, margin: "60px auto 0 auto", textAlign: "center", display: "flex", flexDirection: "column", gap: 48, padding: "16px 0" }}>
        <h1 style={{ fontSize: "2.2em", color: "#ffd700", marginBottom: 32 }}>Contatti</h1>
        <div className="contact-card" style={{ marginBottom: 0, padding: 32, background: "#181818", borderRadius: 18, boxShadow: "0 0 16px #ffd700", minHeight: 120 }}>
          <h2 style={{ color: "#ffd700", marginBottom: 18, fontSize: "1.7em" }}>TELEFONO</h2>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: "1.55em", color: "#ffd700", fontWeight: "bold", letterSpacing: 1, marginBottom: 8 }}>+39 371 1532403</span>
            <a className="glow-btn" href="tel:+393711532403" style={{ background: "#ffd700", color: "#222", fontWeight: "bold", borderRadius: 12, padding: "16px 48px", fontSize: "1.25em", textDecoration: "none", boxShadow: "0 0 8px #ffd700", cursor: "pointer", textShadow: "0 0 4px #ffd700" }}>Chiama</a>
          </div>
        </div>
        <div className="contact-card" style={{ marginBottom: 0, padding: 32, background: "#181818", borderRadius: 18, boxShadow: "0 0 16px #ffd700", minHeight: 180 }}>
          <h3 style={{ color: "#ffd700", marginBottom: 18, fontSize: "1.5em" }}>Scrivi un messaggio</h3>
          <ContactForm />
        </div>
        <div className="contact-card" style={{ marginBottom: 0, padding: 32, background: "#111", borderRadius: 18, boxShadow: "0 0 16px #ffd700", minHeight: 120 }}>
          <h2 style={{ color: "#ffd700", marginBottom: 18, fontSize: "1.7em" }}>INDIRIZZO</h2>
          <div style={{ fontSize: "1.35em", color: "#fcfbfb", fontWeight: "bold", marginBottom: 18 }}>Corso Francia 169, Torino (To) Italia</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <iframe
              title="Google Maps"
              src="https://www.google.com/maps?q=Corso+Francia+169,+Torino,+Italia&output=embed"
              width="100%"
              height="260"
              style={{ border: "3px solid #ffd700", borderRadius: 16, boxShadow: "0 0 16px #ffd700", marginBottom: 18 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            <a className="glow-btn" href="https://share.google/WoJQ6fCnnUcrPv7dl" target="_blank" rel="noopener noreferrer" style={{ marginTop: 12, fontSize: "1.15em", background: "#ffd700", color: "#222", borderRadius: 12, padding: "12px 32px", textDecoration: "none", fontWeight: "bold", boxShadow: "0 0 8px #ffd700", textShadow: "0 0 4px #ffd700" }}>Apri su Google Maps</a>
          </div>
        </div>
      <style>{`
        .glow-btn:hover {
          box-shadow: 0 0 32px 8px #ffd700, 0 0 16px #fff;
          text-shadow: 0 0 8px #ffd700, 0 0 16px #fff;
          animation: pulse-glow 1.2s infinite;
        }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 32px 8px #ffd700, 0 0 16px #fff; }
          50% { box-shadow: 0 0 16px 4px #ffd700, 0 0 8px #fff; }
          100% { box-shadow: 0 0 32px 8px #ffd700, 0 0 16px #fff; }
        }

        /* Mobile-friendly sizing & centering for Contatti */
        @media (max-width: 600px) {
          .page-contatti .contacts-container { max-width: 92vw !important; margin: 24px auto 0 auto !important; gap: 24px !important; padding: 8px 0 !important; }
          .page-contatti .contact-card { padding: 18px !important; border-radius: 14px !important; }
          .page-contatti h1 { font-size: 1.4em !important; margin-bottom: 16px !important; }
          .page-contatti h2 { font-size: 1.2em !important; }
          .page-contatti h3 { font-size: 1.1em !important; }
          .page-contatti .glow-btn { font-size: 1rem !important; padding: 10px 18px !important; }
          .page-contatti textarea { max-width: 92vw !important; padding: 16px !important; font-size: 1rem !important; }
          .page-contatti iframe { height: 200px !important; }
          .page-contatti span, .page-contatti .contact-text { font-size: 1.05em !important; }
        }

        /* Ensure visible button-like menu on mobile with pulsing backdrop */
        @keyframes buttonPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(0,224,255,0.25), 0 0 0 rgba(0,224,255,0); }
          50% { box-shadow: 0 0 16px rgba(0,224,255,0.5), 0 0 28px rgba(0,224,255,0.35); }
        }
        @media (hover: none), (pointer: coarse), (max-width: 900px) {
          .page-contatti .navbar a::before {
            background: rgba(0,0,0,0.7) !important;
            border: 1px solid rgba(255,255,255,0.12);
          }
          .page-contatti .navbar a.active::before {
            animation: buttonPulse 2.2s ease-in-out infinite !important;
          }
        }
      `}</style>
      </div>
      <div className="youtube-under-menu">
        <YouTubeButton small layout="row" />
      </div>
      <div style={{ marginTop:16, display:'flex', justifyContent:'center' }}>
  <BrandButton onClick={() => { setOverlaySource('studio'); setShowOverlay(true); }} />
      </div>
  <Footer showArteButton={false} />
  <AIAssistantWidget page="contatti" />
    </div>
  );
}
