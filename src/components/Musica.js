import React, { useEffect, useState, useRef } from 'react';
import { FaPlayCircle, FaDownload } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import Footer from './Footer';
import NavBar from './NavBar';
import { db } from './firebase';
import { collection, onSnapshot, getDocs, doc } from 'firebase/firestore';
import LogoPrompt from './LogoPrompt';
import FullscreenVideoOverlay from './FullscreenVideoOverlay';
import './Artisti.css';

export default function Musica() {
  const navigate = useNavigate();
  // Rimosso currentIdx: non usato nell'interfaccia corrente
  const [tracks, setTracks] = useState([]); // streaming + acquistabili
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const audioRef = useRef(null); // anteprima 15s
  const [previewId, setPreviewId] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  const [logoVideoUrl, setLogoVideoUrl] = useState('');
  const [overlaySource, setOverlaySource] = useState(null); // 'studio' | 'logo'
  const [logoDismissed, setLogoDismissed] = useState(() => {
    try { return localStorage.getItem('ar_logo_clicked') === '1'; } catch { return false; }
  });

  // Config video studio
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
  setStudioVideoUrl(data?.studioVideoUrl || '');
  setLogoVideoUrl(data?.logoVideoUrl || '');
    });
    return () => unsub();
  }, []);

  // Carica streaming artisti
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = [];
        const artistsSnap = await getDocs(collection(db, 'artisti'));
        for (const adoc of artistsSnap.docs) {
          const artist = adoc.data();
          if (Array.isArray(artist.albums)) {
            for (const album of artist.albums) {
              if (Array.isArray(album.tracks)) {
                for (const t of album.tracks) {
                  if (t?.link) {
                    list.push({
                      id: `stream_${adoc.id}_${album.title || 'album'}_${t.title || 'track'}`,
                      title: t.title || 'Senza titolo',
                      audioUrl: t.link,
                      genre: album.genre || '',
                      artist: artist.nome || artist.name || '',
                      isBuyMusic: false,
                      price: null,
                      paymentLinkUrl: null,
                      downloadLink: null,
                      sold: false
                    });
                  }
                }
              }
            }
          }
        }
        if (active) setTracks(list);
      } catch (e) { console.error('Errore streaming', e); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  // Realtime tracce acquistabili (musicaTracks)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'musicaTracks'), (snap) => {
      const STRIPE_LINK_SINGLE_1_99 = 'https://buy.stripe.com/test_single199';
      const STRIPE_LINK_ALBUM_9_99 = 'https://buy.stripe.com/test_album999';
      const STRIPE_LINK_PACK_100 = 'https://buy.stripe.com/test_pack10000';
      const approx = (a, b, eps = 0.02) => Math.abs((Number(a)||0) - (Number(b)||0)) <= eps;
      const buyTracks = snap.docs.map(d => {
        const t = { id: d.id, ...d.data() };
        let priceNum = null;
        if (t.price !== undefined && t.price !== null && t.price !== '') {
          if (typeof t.price === 'number') priceNum = t.price; else {
            const p = parseFloat(String(t.price).replace(',', '.')); if (Number.isFinite(p)) priceNum = p;
          }
        }
        if (priceNum == null) priceNum = 1.99;
        let paymentLink = t.paymentLinkUrl || '';
        if (!paymentLink) {
          if (approx(priceNum, 1.99)) paymentLink = STRIPE_LINK_SINGLE_1_99;
          else if (approx(priceNum, 9.99)) paymentLink = STRIPE_LINK_ALBUM_9_99;
          else if (approx(priceNum, 100)) paymentLink = STRIPE_LINK_PACK_100;
        }
        return {
          id: `buy_${t.id}`,
          title: t.title || 'Senza titolo',
          audioUrl: t.fullAudioUrl || t.audioUrl || '',
          genre: t.genre || '',
          artist: t.artist || t.autore || '',
          isBuyMusic: true,
          price: priceNum,
          paymentLinkUrl: paymentLink || null,
          previewAudioUrl: t.previewAudioUrl || '',
          paypalLinkUrl: t.paypalLinkUrl || '',
          downloadLink: t.downloadLink || null,
          sold: !!t.sold
        };
      });
      setTracks(prev => {
        const streaming = prev.filter(x => !x.id.startsWith('buy_'));
        return [...streaming, ...buyTracks];
      });
    });
    return () => unsub();
  }, []);

  // Filtra per ricerca
  const filteredTracks = tracks.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (t.title||'').toLowerCase().includes(q) || (t.artist||'').toLowerCase().includes(q);
  });
  // Nessun currentTrack necessario: la UI non mostra una traccia "corrente"

  function playPreview(track) {
    if (!track?.isBuyMusic || !track.audioUrl) return;
    const audio = audioRef.current; if (!audio) return;
    if (previewId === track.id) { audio.pause(); audio.currentTime = 0; setPreviewId(null); return; }
    audio.pause(); audio.currentTime = 0; audio.src = '';
    setTimeout(() => {
      audio.src = track.audioUrl; audio.currentTime = 0; audio.play().catch(()=>{}); setPreviewId(track.id);
    }, 60);
  }

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => { if (previewId && a.currentTime >= 15) { a.pause(); a.currentTime = 0; setPreviewId(null); } };
    a.addEventListener('timeupdate', onTime);
    return () => a.removeEventListener('timeupdate', onTime);
  }, [previewId]);

  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 600 : false;

  return (
    <div className="publicsite-bg page-musica">
      {/* Intro vocale rimossa */}
      <Link to="/login" className="dash-badge">Dashboard</Link>
      {/* Logo centrale cliccabile */}
  <div className="logo-wrapper" style={{ margin: isMobile ? '22px 0 34px 0' : '28px 0 56px 0', cursor:'pointer', position:'relative' }} onClick={() => { if(!logoDismissed){ try { localStorage.setItem('ar_logo_clicked','1'); } catch {}; setLogoDismissed(true);} setOverlaySource('logo'); setShowOverlay(true); }} title="Video Logo">
        <LogoPrompt show={!showOverlay && !logoDismissed} text="Premi" position="top" />
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      {/* Pulsante Back globale */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
        style={{
          position:'fixed',
          top:'12px',
          left:'12px',
          zIndex:100002,
          background:'rgba(0,0,0,0.55)',
          border:'1px solid #ffd700',
          color:'#ffd700',
          borderRadius:'50%',
          width:46,
          height:46,
          display:'flex',
          alignItems:'center',
          justifyContent:'center',
          cursor:'pointer',
          boxShadow:'0 0 12px #000'
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div className="container" style={{ maxWidth:900, margin: isMobile? '16px auto':'32px auto', padding: isMobile? '0 2vw':'0 3vw' }}>
        <h1 className="publicsite-title" style={{
          textAlign: "center",
          fontSize: isMobile ? '1.2em' : 'clamp(1.3em, 6vw, 2.2em)',
          marginBottom: isMobile ? 10 : 18
        }}>Tutti i Brani</h1>
        <div style={{ textAlign: 'center', margin: isMobile ? '10px 0 14px 0' : '18px 0 24px 0' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cosa vuoi ascoltare? (titolo o artista)"
            style={{
              width: isMobile ? '92vw' : '96vw',
              maxWidth: isMobile ? 320 : 420,
              padding: isMobile ? '10px 12px' : '14px 18px',
              fontSize: isMobile ? '1em' : 'clamp(1em, 4vw, 1.15em)',
              borderRadius: 10,
              border: '2px solid #ffd700',
              background: '#111',
              color: '#ffd700',
              marginBottom: 8,
              boxSizing: 'border-box'
            }}
          />
        </div>
  {loading ? (
          <div style={{ color: "#ffd700", textAlign: "center", marginTop: 24 }}>Caricamento…</div>
        ) : filteredTracks.length === 0 ? (
          <div style={{ color: "#ffd700", textAlign: "center", marginTop: 24 }}>Nessun brano disponibile.</div>
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: isMobile ? 32 : 64
          }}>
            {filteredTracks.map(track => (
              <div key={track.id} style={{
                background: "#181818",
                borderRadius: 12,
                padding: isMobile ? '2vw 1vw' : '4vw 2vw',
                boxShadow: "0 0 12px #ffd700",
                display: "flex",
                flexDirection: 'column',
                alignItems: "stretch",
                gap: 12
              }}>
                <div style={{ width: '100%' }}>
                  <div style={{ color: "#ffd700", fontWeight: "bold", fontSize: isMobile ? "1em" : "1.15em" }}>{track.title || "Senza titolo"}</div>
                  {track.artist && <div style={{ color: "#bbb", fontSize: isMobile ? "0.9em" : "0.95em" }}>{track.artist}</div>}
                  {track.genre && <div style={{ color: "#bbb", fontSize: isMobile ? "0.9em" : "0.95em" }}>{track.genre}</div>}
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMobile ? 'center' : 'flex-end',
                  minWidth: 120,
                  width: '100%'
                }}>
                  <span style={{ color:'#ffd700', fontWeight:700, fontSize:isMobile?'1em':'1.1em', marginBottom:8 }}>
                    {track.isBuyMusic ? `€ ${(Number(track.price)||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : 'Gratis'}
                  </span>
                  {track.isBuyMusic ? (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:isMobile?'center':'flex-end', gap:8 }}>
                      {/* Anteprima 15s */}
                      {track.audioUrl && (
                        <button
                          onClick={() => playPreview(track)}
                          style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}
                          title={previewId === track.id ? 'In ascolto (15s)' : 'Anteprima 15s'}
                          aria-label="Anteprima 15s"
                        >
                          <FaPlayCircle size={isMobile ? 34 : 42} color="#ffd700" style={{ filter: previewId === track.id ? 'drop-shadow(0 0 8px #ffd700)' : 'none' }} />
                        </button>
                      )}
                      {/* Pulsante acquisto / download (replica logica ArtistDetail: Stripe -> PayPal -> downloadLink -> disabled) */}
                      {(() => {
                        const approx = (a,b,eps=0.02)=>Math.abs((Number(a)||0)-(Number(b)||0))<=eps;
                        const price = Number(track.price)||0;
                        const hostedSingle = '5CGE5SB2DM2G2';
                        const hostedAlbum = 'P7FKWUEHQGCFE';
                        const hostedPack = '49B6QFGV44SP4';
                        // Decide hosted button id (single default 1.99, album 9.99, pack 100)
                        let hostedId = hostedSingle;
                        if (approx(price,9.99)) hostedId = hostedAlbum; else if (approx(price,100)) hostedId = hostedPack;
                        const origin = (typeof window !== 'undefined') ? window.location.origin : '';
                        if (track.sold && track.downloadLink) {
                          return (
                            <a href={track.downloadLink} download className="icon-cell icon-cell--download pulse-on-hover" aria-label="Download acquistato" title="Download acquistato" style={{ textDecoration:'none' }}>
                              <img src="/icons/download5.png" alt="Download" />
                            </a>
                          );
                        }
                        if (track.paymentLinkUrl) {
                          return (
                            <a href={track.paymentLinkUrl} target="_blank" rel="noopener noreferrer" className="icon-cell icon-cell--download pulse-on-hover" aria-label="Buy & Download" title="Buy & Download" style={{ textDecoration:'none' }}>
                              <img src="/icons/download5.png" alt="Buy & Download" />
                            </a>
                          );
                        }
                        // PayPal fallback: usa link diretto se definito paypalLinkUrl altrimenti hosted button form
                        if (track.paypalLinkUrl) {
                          return (
                            <a href={track.paypalLinkUrl} target="_blank" rel="noopener noreferrer" className="icon-cell icon-cell--download pulse-on-hover" aria-label="PayPal & Download" title="PayPal & Download" style={{ textDecoration:'none' }}>
                              <img src="/icons/download5.png" alt="PayPal & Download" />
                            </a>
                          );
                        }
                        if (track.downloadLink) {
                          return (
                            <a href={track.downloadLink} className="icon-cell icon-cell--download pulse-on-hover" aria-label="Download" title="Download" style={{ textDecoration:'none' }}>
                              <img src="/icons/download5.png" alt="Download" />
                            </a>
                          );
                        }
                        // Hosted button PayPal (form) fallback
                        return (
                          <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top" className="icon-cell icon-cell--download pulse-on-hover" aria-label="Buy" title="Buy" style={{ display:'inline-flex' }}>
                            <input type="hidden" name="cmd" value="_s-xclick" />
                            <input type="hidden" name="hosted_button_id" value={hostedId} />
                            <input type="hidden" name="currency_code" value="EUR" />
                            <input type="hidden" name="custom" value={`musica:${track.id}`} />
                            <input type="hidden" name="return" value={`${origin}/download-confirm?cm=${encodeURIComponent(`musica:${track.id}`)}`} />
                            <input type="hidden" name="cancel_return" value={`${origin}/musica`} />
                            <button type="submit" style={{ background:'transparent', border:'none', padding:0, margin:0, width:'100%', height:'100%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <img src="/icons/download5.png" alt="Buy" />
                            </button>
                          </form>
                        );
                      })()}
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10, alignItems:isMobile?'center':'flex-end' }}>
                      {track.audioUrl ? (
                        <audio controls src={track.audioUrl} style={{ minWidth:isMobile?180:240, maxWidth:isMobile?240:340 }} />
                      ) : (
                        <span style={{ color:'#888' }}>Audio non disponibile</span>
                      )}
                      {track.audioUrl && (
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <a href={track.audioUrl} download style={{ background:'#ffd700', color:'#222', borderRadius:8, padding:isMobile?'6px 14px':'8px 20px', fontWeight:700, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:8 }}>
                            <FaDownload size={isMobile?16:20} /> Download
                          </a>
                          <span style={{ color:'#fff', fontWeight:700, fontSize:isMobile?'0.9em':'1em' }}>1,99 EURO</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
  <audio ref={audioRef} style={{ display:'none' }} preload="auto" />
      </div>
      <FullscreenVideoOverlay
        show={showOverlay && ((overlaySource === 'studio' && !!studioVideoUrl) || (overlaySource === 'logo' && !!logoVideoUrl))}
        src={overlaySource === 'studio' ? studioVideoUrl : logoVideoUrl}
        onClose={() => setShowOverlay(false)}
        attemptUnmuted
      />
      <NavBar />
      <div style={{ marginTop: 12, display:'flex', justifyContent:'center' }}>
        <button type="button" onClick={() => { setOverlaySource('studio'); setShowOverlay(true); }}
          style={{ background:'linear-gradient(135deg,#004b92 0%,#008dff 55%,#00e0ff 100%)', padding:'10px 28px', borderRadius:16, fontWeight:800, color:'#fff', cursor:'pointer', boxShadow:'0 0 18px #00bbff', border:'none' }}
          aria-label="Mostra video Arte Registrazioni">
          Arte Registrazioni
        </button>
      </div>
  <Footer />
    </div>
  );
}