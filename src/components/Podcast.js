import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import LogoPrompt from './LogoPrompt';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import './Artisti.css';
import { db } from './firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

// Funzione di utilità per timestamp (se serve)
function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (typeof ts === 'string') {
    const t = Date.parse(ts);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

// Funzione per ottenere embed YouTube (se serve)
function getYouTubeEmbed(url) {
  if (!url) return '';
  // Regex compatibile per vari formati di URL YouTube
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}?rel=0` : '';
}

export default function Podcast() {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  const [logoVideoUrl, setLogoVideoUrl] = useState('');
  const [overlaySource, setOverlaySource] = useState(null);
  const promoRef = useRef(null);
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'podcasts'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
        const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return toMs(a.createdAt) - toMs(b.createdAt);
      });
      setVideos(list);
      if (!list.find(v => v.id === selectedId)) {
        setSelectedId(list.length ? list[0].id : null);
      }
    });
    // Carica studioVideoUrl da Firestore
    const unsubStudio = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setStudioVideoUrl(data?.studioVideoUrl || '');
      setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => { unsub(); unsubStudio(); };
  }, [selectedId]);

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

  const selected = useMemo(() => videos.find(v => v.id === selectedId) || null, [videos, selectedId]);
  const ytEmbed = selected?.youtubeUrl ? getYouTubeEmbed(selected.youtubeUrl) : '';

  return (
    <div className="publicsite-bg page-podcast">
  <Link to="/login" className="dash-badge">Dashboard</Link>
  <div className="logo-wrapper" style={{ cursor: 'pointer', position:'relative' }} onClick={() => { if(!logoDismissed){ try { localStorage.setItem('ar_logo_clicked','1'); } catch {}; setLogoDismissed(true);} openOverlay('logo'); }} title="Video Logo">
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
      <NavBar />
      <div className="container" style={{ maxWidth: 1100, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>Podcast</h1>
        <p className="publicsite-desc" style={{ textAlign: 'center' }}>
          Benvenuti nella pagina Podcast di Arte Registrazioni!<br/>
          Qui potete seguire le interviste agli artisti di Arte Registrazioni scegliendo tra i filmati.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
          <div style={{ color: '#ffd700', fontWeight: 600, textAlign: 'center' }}>
            Per partecipare dal vivo ai podcast o fare una richiesta contattaci qui
          </div>
          <Link to="/contatti" className="glow-btn" style={{ background: '#ffd700', color: '#222', fontWeight: 'bold', borderRadius: 12, padding: '10px 22px', textDecoration: 'none', boxShadow: '0 0 8px #ffd700' }}>
            Contatti
          </Link>
        </div>

        {/* Player principale */}
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <div style={{ width: '100%', maxWidth: 1000, borderRadius: 12, overflow: 'hidden', boxShadow: '0 0 16px #ffd700' }}>
              {ytEmbed ? (
                <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                  <iframe
                    src={ytEmbed}
                    title={selected.title || 'Podcast'}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  />
                </div>
              ) : selected.videoUrl ? (
                <video
                  src={selected.videoUrl}
                  controls
                  playsInline
                  style={{ width: '100%', height: 'auto', background: '#000' }}
                />
              ) : (
                <div style={{ color: '#ffd700', textAlign: 'center', padding: 20 }}>Video non disponibile</div>
              )}
            </div>
            <div style={{ maxWidth: 1000, width: '100%', color: '#fff' }}>
              <h2 style={{ margin: '8px 0', color: '#ffd700' }}>{selected.title || 'Senza titolo'}</h2>
              {selected.description ? (
                <p style={{ margin: '6px 0 0' }}>{selected.description}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 12 }}>Nessun contenuto disponibile.</div>
        )}

        {/* Lista filmati */}
        {videos.length > 1 ? (
          <div className="gallery" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', marginTop: 18 }}>
            {videos.map(v => (
              <div key={v.id} className="artist-photo" style={{ padding: 12, background: selectedId === v.id ? '#222' : '#111', borderRadius: 12, boxShadow: '0 0 12px #ffd700', cursor: 'pointer' }} onClick={() => setSelectedId(v.id)}>
                <div style={{ height: 140, background: '#000', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 8px #ffd700' }}>
                  <img src="/icons/play4.png" alt="Anteprima" style={{ width: 72, height: 72, opacity: 0.9 }} />
                </div>
                <div style={{ color: '#ffd700', fontWeight: 'bold', marginTop: 8, textAlign: 'center' }}>{v.title || 'Senza titolo'}</div>
                {v.description ? (<div style={{ color: '#fff', opacity: 0.85, fontSize: '0.95em', marginTop: 4, textAlign: 'center' }}>{v.description}</div>) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="youtube-under-menu"><YouTubeButton small layout="row" /></div>
      {/* Overlay video studio */}
      <FullscreenVideoOverlay
        show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
        src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
        onClose={closeOverlay}
        attemptUnmuted
      />
      <div style={{ marginTop: 12, display:'flex', justifyContent:'center' }}>
  <BrandButton onClick={() => openOverlay('studio')} />
      </div>
  <Footer showArteButton={false} />
    </div>
  );
}