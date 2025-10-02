import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import './Artisti.css';
import { db } from './firebase';
import { collection, doc, onSnapshot, getDoc } from 'firebase/firestore';

export default function BuyGenreDetail() {
  const navigate = useNavigate();
  const { gid } = useParams();
  const [genre, setGenre] = useState(null);
  const [tracks, setTracks] = useState([]);
  const audioRef = useRef(null);
  const [currentPreview, setCurrentPreview] = useState(null);

  // PayPal default buttons (provided by user)
  const PAYPAL_LINK_ALBUM_9_99 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=P7FKWUEHQGCFE';
  const PAYPAL_LINK_SINGLE_1_99 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=5CGE5SB2DM2G2';
  const PAYPAL_LINK_BUY_100_00 = 'https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=49B6QFGV44SP4';

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'buyGenres', gid));
        if (active) setGenre(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      } catch {}
    })();
    const unsub = onSnapshot(collection(db, 'buyGenres', gid, 'tracks'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordinamento coerente: order (primaria) -> createdAt (tie-breaker) -> title (stabilità)
      list.sort((a, b) => {
        const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
        const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        if (ams !== bms) return ams - bms;
        return (a.title || '').localeCompare(b.title || '');
      });
      setTracks(list);
    });
    return () => { active = false; unsub && unsub(); };
  }, [gid]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      try {
        if (!currentPreview) return;
        const elapsed = (a.currentTime || 0);
        if (elapsed >= 15) { a.pause(); a.currentTime = 0; setCurrentPreview(null); }
      } catch {}
    };
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, [currentPreview]);

  const startPreview = (track) => {
    try {
      const a = audioRef.current;
      if (!a || !track?.audioUrl) return;
      if (currentPreview && currentPreview.trackId === track.id) { a.pause(); a.currentTime = 0; setCurrentPreview(null); return; }
      a.pause(); a.src = track.audioUrl; a.currentTime = 0; a.play().catch(() => {});
      setCurrentPreview({ trackId: track.id, startedAt: Date.now() });
    } catch {}
  };
  const isPlaying = (tid) => currentPreview && currentPreview.trackId === tid;

  const toHttpsFromGs = (gsUrl) => {
    try {
      const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(gsUrl || '');
      if (!m) return gsUrl;
      const bucket = m[1];
      const path = m[2];
      return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
    } catch { return gsUrl; }
  };

  // (apri link direttamente via onClick sui pulsanti; no helper dedicato)

  return (
    <div className="publicsite-bg page-buymusic">
      <Link to="/login" className="dash-badge">Dashboard</Link>
      <div className="logo-wrapper">
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
      

      <div className="container" style={{ maxWidth: 900, margin: '24px auto', padding: '0 12px' }}>
        <h1 className="publicsite-title" style={{ textAlign: 'center' }}>{genre?.name || 'Genere'}</h1>
        {genre?.coverUrl && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <div className={`genre-cover-frame ${/hip hop/i.test(genre?.name || '') ? 'genre-cover-frame--tight' : ''}`}>
              <img src={genre.coverUrl} alt={genre.name} />
            </div>
          </div>
        )}

        {tracks.length === 0 ? (
          <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 18 }}>Nessun brano in questo genere.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tracks.map((t) => (
              <li key={t.id} className="genre-track" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#141414', borderRadius: 8, padding: '10px 12px', border: '1px solid #222' }}>
                <div className="genre-track-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.sold ? '#e53935' : '#2e7d32', boxShadow: `0 0 6px ${t.sold ? '#e53935' : '#2e7d32'}` }} />
                  <div style={{ color: t.sold ? '#ffb3b3' : '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || 'Brano'}</div>
                  <span style={{ color: t.sold ? '#ff6b6b' : '#8aff8a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {t.sold ? 'Venduto' : 'Disponibile'}
                  </span>
                </div>
                <div className="genre-track-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {(() => {
                    // Compute a default PayPal link based on price when none is provided
                    const parseVal = (v) => {
                      if (typeof v === 'number' && !Number.isNaN(v)) return v;
                      if (typeof v === 'string') {
                        const p = parseFloat(v.replace(',', '.'));
                        if (Number.isFinite(p)) return p;
                      }
                      return null;
                    };
                    const approx = (a, b, eps = 0.02) => Math.abs((a ?? 0) - (b ?? 0)) <= eps;
                    let val = parseVal(t.price);
                    if (val === null) val = parseVal(genre?.defaultPrice);
                    let link = '';
                    if (val !== null) {
                      if (approx(val, 1.99)) link = PAYPAL_LINK_SINGLE_1_99;
                      else if (approx(val, 9.99)) link = PAYPAL_LINK_ALBUM_9_99;
                      else if (approx(val, 100)) link = PAYPAL_LINK_BUY_100_00;
                    }
                    // Attach to element dataset for potential analytics/debug (no visual change)
                    return <span style={{ display: 'none' }} data-default-paypal-link={link || undefined} />;
                  })()}
                  {(() => {
                    const parseVal = (v) => {
                      if (typeof v === 'number' && !Number.isNaN(v)) return v;
                      if (typeof v === 'string') {
                        const p = parseFloat(v.replace(',', '.'));
                        if (Number.isFinite(p)) return p;
                      }
                      return null;
                    };
                    let val = parseVal(t.price);
                    if (val === null) val = parseVal(genre?.defaultPrice);
                    if (val === null) val = 100;
                    const txt = `€ ${val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    return <span className="track-price" style={{ whiteSpace: 'nowrap', color: '#fff', fontWeight: 800, opacity: t.sold ? 0.5 : 1 }}>{txt}</span>;
                  })()}
                  <button type="button" className="icon-cell icon-cell--compact pulse-on-hover" title="Anteprima 15s" aria-label="Anteprima" onClick={() => startPreview(t)}>
                    <img src="/icons/play4.png" alt="Preview" style={{ transform: isPlaying(t.id) ? 'scale(1.05)' : 'none' }} />
                  </button>
                  {t.sold ? (
                    <button type="button" className="icon-cell icon-cell--compact" disabled title="Già venduto" style={{ opacity: 0.5 }}>
                      <img src="/icons/download5.png" alt="Venduto" />
                    </button>
                  ) : t.paymentLinkUrl ? (
                    <button
                      type="button"
                      className="icon-cell icon-cell--compact pulse-on-hover"
                      title="Buy & Download"
                      aria-label="Buy & Download"
                      onClick={() => {
                        try {
                          if (t.paymentLinkUrl) {
                            window.location.assign(t.paymentLinkUrl);
                          }
                        } catch {
                          try { window.location.href = t.paymentLinkUrl; } catch {}
                        }
                      }}
                    >
                      <img src="/icons/download5.png" alt="Buy & Download" />
                    </button>
                  ) : (t.paypalLinkUrl || (() => {
                    // compute default PayPal link again for this branch
                    const parseVal = (v) => {
                      if (typeof v === 'number' && !Number.isNaN(v)) return v;
                      if (typeof v === 'string') {
                        const p = parseFloat(v.replace(',', '.'));
                        if (Number.isFinite(p)) return p;
                      }
                      return null;
                    };
                    const approx = (a, b, eps = 0.02) => Math.abs((a ?? 0) - (b ?? 0)) <= eps;
                    let val = parseVal(t.price);
                    if (val === null) val = parseVal(genre?.defaultPrice);
                    if (val !== null) {
                      if (approx(val, 1.99)) return PAYPAL_LINK_SINGLE_1_99;
                      if (approx(val, 9.99)) return PAYPAL_LINK_ALBUM_9_99;
                      if (approx(val, 100)) return PAYPAL_LINK_BUY_100_00;
                    }
                    return '';
                  })()) ? (
                    <button
                      type="button"
                      className="icon-cell icon-cell--compact pulse-on-hover"
                      onClick={() => {
                        const href = t.paypalLinkUrl || (() => {
                        const parseVal = (v) => {
                          if (typeof v === 'number' && !Number.isNaN(v)) return v;
                          if (typeof v === 'string') {
                            const p = parseFloat(v.replace(',', '.'));
                            if (Number.isFinite(p)) return p;
                          }
                          return null;
                        };
                        const approx = (a, b, eps = 0.02) => Math.abs((a ?? 0) - (b ?? 0)) <= eps;
                        let val = parseVal(t.price);
                        if (val === null) val = parseVal(genre?.defaultPrice);
                        if (val !== null) {
                          if (approx(val, 1.99)) return PAYPAL_LINK_SINGLE_1_99;
                          if (approx(val, 9.99)) return PAYPAL_LINK_ALBUM_9_99;
                          if (approx(val, 100)) return PAYPAL_LINK_BUY_100_00;
                        }
                        return '';
                        })();
                        if (href) {
                          try { window.location.assign(href); } catch { try { window.location.href = href; } catch {} }
                        }
                      }}
                      title="PayPal & Download"
                      aria-label="PayPal & Download"
                    >
                      <img src="/icons/download5.png" alt="PayPal & Download" />
                    </button>
                  ) : t.downloadLink ? (
                    <button
                      type="button"
                      className="icon-cell icon-cell--compact pulse-on-hover"
                      title="Download"
                      aria-label="Download"
                      onClick={() => {
                        const href = t.downloadLink.startsWith('gs://') ? toHttpsFromGs(t.downloadLink) : t.downloadLink;
                        if (!href) return;
                        try { window.location.assign(href); } catch { try { window.location.href = href; } catch {} }
                      }}
                    >
                      <img src="/icons/download5.png" alt="Download" />
                    </button>
                  ) : (
                    <button type="button" className="icon-cell icon-cell--compact" disabled style={{ opacity: 0.4 }}>
                      <img src="/icons/download5.png" alt="Non disponibile" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/buy" className="back-link">Torna ai generi</Link>
        </div>
      </div>

      <audio ref={audioRef} style={{ display: 'none' }} preload="auto" />
      <div className="youtube-under-menu">
        <YouTubeButton small layout="row" />
      </div>
      <Footer />
    </div>
  );
}
