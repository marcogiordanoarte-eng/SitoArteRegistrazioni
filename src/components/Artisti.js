import { doc, collection, onSnapshot } from 'firebase/firestore';
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import LogoPrompt from './LogoPrompt';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import "./Artisti.css";
import { db } from "./firebase";
import Icon from "./Icon";
import NavBar from './NavBar';

export default function Artisti() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  const [logoVideoUrl, setLogoVideoUrl] = useState('');
  const [overlaySource, setOverlaySource] = useState(null); // 'studio' | 'logo'
  const navigate = useNavigate();
  const [currentArtista, setCurrentArtista] = useState(null);
  const [artists, setArtists] = useState([]);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenIdx, setFullscreenIdx] = useState(0);
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });

  // Leggi artisti da Firestore in tempo reale + studioVideoUrl
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "artisti"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => {
        const ao = Number(a.order ?? Number.POSITIVE_INFINITY);
        const bo = Number(b.order ?? Number.POSITIVE_INFINITY);
        if (ao !== bo) return ao - bo;
        const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        return ams - bms;
      });
      setArtists(list);
    });
    const unsubStudio = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setStudioVideoUrl(data?.studioVideoUrl || '');
      setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => { unsub(); unsubStudio(); };
  }, []);

  // Modal secondario non più usato; usiamo fullscreen diretto
  const openFullscreen = (artist, startIdx = 0) => {
    setCurrentArtista(artist);
    setFullscreenIdx(startIdx);
    setFullscreenOpen(true);
  };
  const closeFullscreen = () => setFullscreenOpen(false);
  const nextFs = () => {
    setFullscreenIdx(i => {
      const total = Math.min(3, currentArtista?.steps?.length || 0);
      const next = i + 1;
      if (next >= total) {
        setFullscreenOpen(false);
        if (currentArtista?.id) navigate(`/artista/${currentArtista.id}`);
        return i;
      }
      return next;
    });
  };
  const prevFs = () => setFullscreenIdx(i => Math.max(0, i - 1));

  // Deprecated modal handlers removed; fullscreen overlay is the current UX

  return (
    <div className="publicsite-bg">
      {/* Quick access to Dashboard in top-right, consistent with Home */}
      <Link to="/login" className="dash-badge">Dashboard</Link>
  {/* Intro vocale rimossa */}
  <div className="logo-wrapper" style={{ cursor: 'pointer', marginBottom: '24px', position:'relative' }} onClick={() => { if(!logoDismissed){ try { localStorage.setItem('ar_logo_clicked','1'); } catch {}; setLogoDismissed(true);} setOverlaySource('logo'); setShowOverlay(true); }} title="Video Logo">
    <LogoPrompt show={!showOverlay && !logoDismissed} text="Premi" position="top" />
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

  <div style={{ marginTop: 8, display:'flex', justifyContent:'center' }}>
  <BrandButton onClick={() => { setOverlaySource('studio'); setShowOverlay(true); }} size="lg" />
  </div>
  {/* Galleria artisti */}
  <section className="gallery artist-gallery" style={{ marginBottom: 80 }}>
        {artists.length === 0 ? (
          <p style={{ color: "#ffd700", textAlign: "center" }}>Nessun artista disponibile.</p>
        ) : (
          artists.map((artist) => (
            <div className="artist-photo" key={artist.id} style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img
                src={artist.steps && artist.steps[0] ? artist.steps[0] : artist.photo || "/logo.png"}
                alt={artist.nome}
                tabIndex={0}
                onClick={() => navigate(`/artista/${artist.id}`)}
                style={{ cursor: "pointer", width: 220, height: 275, objectFit: "cover", borderRadius: 12, boxShadow: "0 0 12px #ffd700" }}
              />
            </div>
          ))
        )}
  </section>
  {/* Menu spostato in fondo */}
  <NavBar />
  {/* Fullscreen viewer con mano luminosa e senza testo/frecce */}
      {fullscreenOpen && currentArtista && (
        <div className="fullscreen-backdrop" onClick={closeFullscreen}>
          <img
            src={currentArtista.steps && currentArtista.steps[fullscreenIdx] ? currentArtista.steps[fullscreenIdx] : currentArtista.photo || "/logo.png"}
            alt=""
            className="fullscreen-img"
            onClick={(e) => {
              e.stopPropagation();
              if (currentArtista.steps && currentArtista.steps.length > 1) {
                nextFs();
              }
            }}
            style={{ cursor: currentArtista.steps && currentArtista.steps.length > 1 ? 'pointer' : 'default' }}
          />
          {currentArtista.steps && currentArtista.steps.length > 1 && (
            <>
              <button className="hand-button hand-left" aria-label="precedente" onClick={(e) => { e.stopPropagation(); prevFs(); }}>
                <Icon name="Hand" size={28} color="#00FFFF" />
              </button>
              <button className="hand-button hand-right" aria-label="successiva" onClick={(e) => { e.stopPropagation(); nextFs(); }}>
                <Icon name="Hand" size={28} color="#00FFFF" />
              </button>
            </>
          )}
        </div>
      )}
      <div className="youtube-under-menu">
        <YouTubeButton small layout="row" />
      </div>
      {/* Overlay video studio */}
      <FullscreenVideoOverlay
        show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
        src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
        onClose={() => setShowOverlay(false)}
        attemptUnmuted
      />
  <Footer showArteButton={false} />
      {/* Rimosso AIAssistantWidget duplicato: l'assistente globale è già montato in App.js */}
    </div>
  );
}