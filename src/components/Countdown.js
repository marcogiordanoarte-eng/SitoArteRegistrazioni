import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import LogoPrompt from './LogoPrompt';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import './Artisti.css';
import { db } from './firebase';

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (typeof ts === 'string') {
    const t = Date.parse(ts);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

function formatDHMS(msLeft) {
  let s = Math.max(0, Math.floor(msLeft / 1000));
  const days = Math.floor(s / 86400); s -= days * 86400;
  const hours = Math.floor(s / 3600); s -= hours * 3600;
  const mins = Math.floor(s / 60); s -= mins * 60;
  const secs = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return { days, hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}

export default function Countdown() {
  const navigate = useNavigate();
  const [showOverlay, setShowOverlay] = useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  const [logoVideoUrl, setLogoVideoUrl] = useState('');
  const [overlaySource, setOverlaySource] = useState(null);
  const [items, setItems] = useState([]); // {id, title?, coverUrl, releaseAt, order, createdAt}
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const promoRef = React.useRef(null);
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });

  // Overlay fullscreen logic: pausa/riattiva video principale
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

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'countdowns'),
      (snap) => {
        try {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
            const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
            const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
            if (ao !== bo) return ao - bo;
            const ams = toMillis(a.releaseAt) ?? Number.MAX_SAFE_INTEGER;
            const bms = toMillis(b.releaseAt) ?? Number.MAX_SAFE_INTEGER;
            if (ams !== bms) return ams - bms;
            const ac = toMillis(a.createdAt) ?? Number.MAX_SAFE_INTEGER;
            const bc = toMillis(b.createdAt) ?? Number.MAX_SAFE_INTEGER;
            return ac - bc;
          });
          setItems(list);
          setError(null);
        } catch (e) {
          setError(e && e.message ? e.message : 'Errore nella lettura dei dati');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err && err.message ? err.message : 'Errore nel caricamento dei countdown');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const unsubStudio = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setStudioVideoUrl(data?.studioVideoUrl || '');
      setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => unsubStudio();
  }, []);

  const split = useMemo(() => {
    const upcoming = [];
    const past = [];
    for (const it of items) {
      const r = toMillis(it.releaseAt);
      if (!r) { past.push(it); continue; }
      if (r > now) upcoming.push(it); else past.push(it);
    }
    return { upcoming, past };
  }, [items, now]);

  const MatrixTimer = ({ releaseAt }) => {
    const r = toMillis(releaseAt);
    const left = (r ?? 0) - now;
    const { days, hours, mins, secs } = formatDHMS(left);
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0 12px', boxSizing: 'border-box' }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'clamp(2px, 1vw, 10px)',
          fontFamily: 'monospace',
          color: '#00ff88',
          textShadow: '0 0 18px #00ff88, 0 0 36px rgba(0,255,136,0.6)',
          fontSize: 'clamp(1.2rem, 6vw, 4.2rem)',
          letterSpacing: 1.1,
          lineHeight: 1,
          width: '100%',
          justifyContent: 'center',
          maxWidth: 'calc(100% - 24px)',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums'
        }}>
          <span style={{ textAlign: 'center' }}>{days}</span>
          <span>:</span>
          <span>{hours}</span>
          <span>:</span>
          <span>{mins}</span>
          <span>:</span>
          <span>{secs}</span>
        </div>
      </div>
    );
  };

  const Card = ({ item, showTimer }) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
        {/* Fixed-width wrapper so timer aligns exactly with cover edges */}
        <div style={{ width: 'min(88vw, 480px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="cover-frame" style={{ marginBottom: 0 }}>
            <img src={item.coverUrl || '/logo.png'} alt={item.title || 'Cover'} />
          </div>
          <div style={{ marginTop: 12, width: '100%', display: 'flex', justifyContent: 'center', minHeight: 40 }}>
            {showTimer ? (
              <MatrixTimer releaseAt={item.releaseAt} />
            ) : (
              <div style={{
                display: 'inline-block',
                padding: '8px 12px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.55)',
                color: '#e6fdff',
                fontWeight: 800,
                boxShadow: '0 6px 14px rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                Disponibile ora
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="publicsite-bg page-countdown">
      <Link to="/login" className="dash-badge">Dashboard</Link>
  {/* Intro vocale rimossa */}
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

      <div className="container" style={{ maxWidth: 1280, margin: '28px auto 36px', padding: '0 12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 className="publicsite-title countdown-title">Countdown</h1>

        {loading && (
          <div style={{ color: '#dfffea', background: 'rgba(0,0,0,0.55)', padding: '10px 12px', borderRadius: 10, boxShadow: '0 6px 12px rgba(0,0,0,0.35)', marginTop: 10 }}>
            Caricamento…
          </div>
        )}
        {error && !loading && (
          <div style={{ color: '#ffb3b3', background: 'rgba(0,0,0,0.6)', padding: '10px 12px', borderRadius: 10, boxShadow: '0 6px 12px rgba(0,0,0,0.35)', marginTop: 10 }}>
            Errore: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="gallery-row">
              {split.upcoming.length > 0 ? (
                split.upcoming.map(it => <Card key={it.id} item={it} showTimer />)
              ) : (
                <div style={{ color: '#888', textAlign: 'center', background: 'rgba(0,0,0,0.45)', padding: '10px 12px', borderRadius: 10 }}>
                  Nessun countdown imminente. Torna presto!
                </div>
              )}
            </div>

            {split.past.length > 0 && (
              <div style={{ width: '100%', maxWidth: 980, marginTop: 28 }}>
                <h2 className="publicsite-title" style={{ fontSize: '1.3rem', marginBottom: 8 }}>Uscite recenti</h2>
                <div className="gallery-row">
                  {split.past.map(it => <Card key={it.id} item={it} showTimer={false} />)}
                </div>
              </div>
            )}
          </>
        )}
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