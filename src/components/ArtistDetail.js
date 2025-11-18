import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import SocialMinimal from './SocialMinimal';
import Footer from './Footer';
import "./Artisti.css";
import { db, registerLivePlayEvent } from './firebase';
import { usePlayer } from './PlayerContext';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Link } from 'react-router-dom';

// Utility: controlla se un URL punta a un file audio riproducibile direttamente
function isSafariLike() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Safari\//.test(ua) && !/Chrome\//.test(ua);
}
function isPlayableAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.split('?')[0].toLowerCase();
  const isHls = clean.endsWith('.m3u8');
  // HLS nativo: ok su Safari, evitare su Chrome senza hls.js
  if (isHls) return isSafariLike();
  return ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.mp4', '.webm'].some(ext => clean.endsWith(ext));
}

// Raccoglie il miglior URL audio da un oggetto traccia (considerando campi comuni)
function pickBestAudioUrlFromTrack(track) {
  if (!track || typeof track !== 'object') return '';
  const candidates = [
    track.streamAudioUrl,
    track.previewUrl,
    track.previewAudioUrl,
    track.audioPreviewUrl,
    track.fullAudioUrl,
    track.audioUrl,
    track.url,
    track.fileUrl,
    track.streamUrl,
    track.link,
  ].filter(Boolean);
  for (const u of candidates) {
    if (isPlayableAudioUrl(u)) return u;
  }
  return '';
}

// Normalizza stringhe per matching robusto titolo->traccia dashboard
function normalizeTitle(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}+/gu, '') // rimuovi accenti
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ') // rimuovi parentesi e contenuto
    .replace(/[^a-z0-9\s]/g, ' ') // rimuovi punteggiatura
    .replace(/\s+/g, ' ') // comprimi spazi
    .trim();
}

function jaccardTokenSim(a, b) {
  const A = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const B = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  const uni = A.size + B.size - inter;
  return inter / (uni || 1);
}

// Piccolo hint per mostrare le label (placeholder: qui non eseguiamo nulla di complesso)
function showLabelHint() { /* no-op placeholder; in futuro potresti aggiungere tooltip animati */ }

export default function ArtistDetail() {
  // Simple locale detection for button labels
  const locale = ((((typeof navigator !== 'undefined') && navigator.language) || 'it').toLowerCase().startsWith('it')) ? 'it' : 'en';
  const t = (key) => {
    const dict = {
      worldListens: { it: 'Ascolti dal Mondo', en: 'World Listens' },
      game: { it: 'Gioco', en: 'Game' },
      artistDashboard: { it: 'Dashboard Artista', en: 'Artist Dashboard' },
      back: { it: 'Indietro', en: 'Back' },
    };
    return (dict[key] && (dict[key][locale] || dict[key].it)) || key;
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [artistTracks, setArtistTracks] = useState([]); // tracce caricate in dashboard (subcollection)
  // Nessun messaggio UI per l'audio richiesto: rimosso
  const [trackIndexByAlbum, setTrackIndexByAlbum] = useState({});
  const [videoError, setVideoError] = useState({});
  // Rimozione stati inutilizzati per pulizia ESLint
  const [showIntroForIdx, setShowIntroForIdx] = useState(null); // fullscreen video index
  const [showPortraitFs, setShowPortraitFs] = useState(false); // fullscreen portrait
  const [showStepsFsIdx, setShowStepsFsIdx] = useState(null); // fullscreen steps image index
  // Pulsanti voce reale disattivati: stati e riferimenti rimossi

  const audioRefs = useRef({});
  const videoRefs = useRef({});
  const albumRefs = useRef({});
  const fsVideoRef = useRef(null);
  const lastPlayGestureTsRef = useRef(0);
  const forceFallback = false; // switch manuale se vuoi forzare fallback video
  const lastPulseRef = useRef(0);
  const player = usePlayer();
  // Fallback rapido: se non abbiamo un URL audio diretto, prova a recuperare una preview da Apple iTunes Search API (pubblica)
  async function fetchApplePreviewUrl(trackTitle, artistName) {
    try {
      const term = encodeURIComponent(`${trackTitle || ''} ${artistName || ''}`.trim());
      if (!term) return '';
      const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=5`;
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 2500);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!resp.ok) return '';
      const data = await resp.json().catch(() => ({}));
      const results = Array.isArray(data.results) ? data.results : [];
      // Scegliamo la preview con similarità migliore sul titolo
      let best = null; let bestScore = -1;
      results.forEach(r => {
        const score = jaccardTokenSim(trackTitle || '', r.trackName || '');
        if (score > bestScore) { bestScore = score; best = r; }
      });
      if (best && best.previewUrl && isPlayableAudioUrl(best.previewUrl)) return best.previewUrl;
      // fallback: prima previewUrl valida in lista
      const any = results.find(r => r.previewUrl && isPlayableAudioUrl(r.previewUrl));
      return any ? any.previewUrl : '';
    } catch { return ''; }
  }
  function tryRegisterPlayPulse() {
    const now = Date.now();
    if (now - (lastPulseRef.current || 0) < 8000) return; // anti-spam 8s
    lastPulseRef.current = now;
    registerLivePlayEvent({ artistId: (artist?.id || id), city: 'Roma', country: 'Italia' }).catch(()=>{});
  }

  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, 'artisti', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Artista non trovato');
        const artistData = { id: snap.id, ...snap.data() };
        if (!aborted) setArtist(artistData);
        // carica anche le tracce singole dell'artista (per avere audio reali)
        try {
          const tracksCol = collection(db, 'artisti', snap.id, 'tracks');
          const tSnap = await getDocs(tracksCol);
          if (!aborted) {
            const list = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setArtistTracks(list);
          }
        } catch {
          if (!aborted) setArtistTracks([]);
        }
      } catch (e) {
        if (!aborted) setError(e.message || 'Errore caricamento artista');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    if (id) load();
    return () => { aborted = true; };
  }, [id]);

  // Rimosso fetch streaming su pagina pubblica: i dati sono mostrati nella World Map

  // Fullscreen handlers (CRT video)
  const openFullscreen = (albumIdx) => setShowIntroForIdx(albumIdx);
  const closeFullscreenSync = () => setShowIntroForIdx(null);

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 80 }}>Caricamento...</div>;
  if (error) return <div style={{ color: 'tomato', textAlign: 'center', marginTop: 80 }}>{error}</div>;
  if (!artist) return null;
  // Usa la QUARTA foto caricata (index 3) come ritratto principale, fallback a photo e poi alla prima.
  const portraitSrc = artist.profileUrl || ((artist.steps && artist.steps[3])
    ? artist.steps[3]
    : (artist.photo || (artist.steps && artist.steps[0]) || null));

  return (
    <div className="publicsite-bg artist-detail" style={{ paddingBottom: 60 }}>
      {/* Pulsante blu per Dashboard (localizzato) */}
      <Link
        to={`/artist-login?aid=${encodeURIComponent(artist.id || id)}`}
        className="glow-btn glow-btn--blue"
        title={t('artistDashboard')}
        aria-label={t('artistDashboard')}
        style={{ position:'fixed', top:12, right:12, zIndex:10001 }}
      >
        {t('artistDashboard')}
      </Link>
      <button
        onClick={() => navigate(-1)}
        aria-label={t('back')}
        title={t('back')}
        style={{ position:'fixed', top:10, left:10, zIndex:10000, background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)', border:'2px solid #ffd700', width:44, height:44, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px rgba(255,215,0,0.6)' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <NavBar />
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 30 }}>
        {/* Foto profilo artista sopra tutto (se disponibile) */}
        {portraitSrc && (
          <div className="artist-portrait-wrapper" style={{ marginBottom: 24, display: 'flex', justifyContent: 'center', width: '100%' }}>
            <img
              src={portraitSrc}
              alt={artist.nome || artist.name || 'Ritratto artista'}
              className="artist-portrait"
              style={{ cursor: 'zoom-in', width: 'min(300px,70vw)', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 24, boxShadow: '0 0 18px rgba(255,215,0,0.55), 0 0 42px rgba(255,215,0,0.18)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => setShowPortraitFs(true)}
            />
          </div>
        )}
        <h1 className="artist-name" style={{ textAlign: 'center', maxWidth: '92vw' }}>{artist.nome || artist.name || 'Artista'}</h1>
        {/* Social bar: mostra solo social dell'artista; niente pulsanti Spotify/Apple (usati solo per tracciamento) */}
        {(artist.socials && (artist.socials.instagram || artist.socials.youtube || artist.socials.facebook)) ? (
          <SocialMinimal
            facebook={artist.socials.facebook}
            youtube={artist.socials.youtube}
            instagram={artist.socials.instagram}
            style={{ marginTop: 6, marginBottom: 6 }}
          />
        ) : null}
        {artist.website && (
          <div style={{ marginTop: 6 }}>
            <a href={artist.website} target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Sito web" style={{ textDecoration:'none', color:'#ffd700', fontWeight:700 }}>
              🌐 Sito web
            </a>
          </div>
        )}

        {artist.bio && (
          <div className="bio-box" style={{ maxWidth: 860, width: 'min(92vw,860px)', marginTop: 12, lineHeight: 1.55, color: '#fcfbfb', position:'relative', paddingTop: 0 }}>
            <p className="bio-text" style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#fcfbfb', fontSize: '1.02rem' }}>{artist.bio}</p>
            <div style={{ marginTop: 14, display:'flex', gap:12, flexWrap:'wrap' }}>
              {/* Pulsante blu: Ascolti dal Mondo */}
              <button
                type="button"
                onClick={() => navigate(`/worldmap/${encodeURIComponent(artist.id || id)}`)}
                style={{ background:'#0b2a6f', border:'1px solid #3b82f6', color:'#e6f0ff', padding:'8px 14px', borderRadius:12, cursor:'pointer', fontWeight:600, fontSize:'.85rem', letterSpacing:.5 }}
              >{t('worldListens')} →
              </button>
              <button
                type="button"
                onClick={() => navigate('/pentagramma')}
                style={{ background:'#111', border:'1px solid #ffd700', color:'#ffd700', padding:'8px 14px', borderRadius:12, cursor:'pointer', fontWeight:600, fontSize:'.8rem', letterSpacing:.5 }}
              >{t('game')} →
              </button>
            </div>
          </div>
        )}

        {/* Elenco dischi: nuovo ordine 1) Cover 2) Pulsanti 3) Frecce 4) Disco animato */}
        {/* Spotlight */}
        {Array.isArray(artist.spotlight) && artist.spotlight.length > 0 && (
          <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: '1fr', gap: 10, width:'min(92vw, 560px)' }}>
            <h3 className="dash-section-title" style={{ textAlign:'center' }}>In evidenza</h3>
            {artist.spotlight.map((it, i) => (
              <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:10, background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.08)', color:'#fff', textDecoration:'none' }}>
                <span style={{ fontWeight:700 }}>{it.title || it.url}</span>
                <span style={{ color:'#ffd700' }}>→</span>
              </a>
            ))}
          </div>
        )}

        {(artist.albums || []).length > 0 && (
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 56, alignItems: 'center', width: '100%' }}>
            {(artist.albums || []).map((album, idx) => {
              const tracks = Array.isArray(album.tracks) ? album.tracks : [];
              const hasTracks = tracks.length > 0;
              const tIdx = trackIndexByAlbum[idx] ?? 0;
              const currentTrack = hasTracks ? tracks[Math.min(tIdx, tracks.length - 1)] : null;
              const playBtn = !hasTracks && album.buttons && album.buttons.find(b => (b.name || "").toLowerCase() === "play" && b.link);
              const trackCount = tracks.length;
              const isSingle = (trackCount === 1) || (!hasTracks && !!playBtn);
              const priceLabel = isSingle ? 'Singolo \u20ac 1,99' : 'Album \u20ac 9,99';
              // PRIORITA' AGGIORNATA: prima album.streamAudioUrl (streaming completo) poi eventuale master/download, poi traccia corrente, poi Play button legacy, poi match tracce subcollection.
              const albumLevelCandidates = [
                album.streamAudioUrl,
                album.fullAudioUrl,
                album.downloadLink,
              ].filter(u => u && isPlayableAudioUrl(u));
              let candidateSrc = albumLevelCandidates[0] || '';
              // Se abbiamo tracce, proviamo preferenza sulla traccia selezionata (potrebbe avere streamAudioUrl specifico)
              const trackCandidate = pickBestAudioUrlFromTrack(currentTrack || {});
              if (hasTracks && isPlayableAudioUrl(trackCandidate)) {
                candidateSrc = trackCandidate;
              }
              // Fallback al bottone Play se ancora vuoto
              if (!candidateSrc && playBtn && isPlayableAudioUrl(playBtn.link)) {
                candidateSrc = playBtn.link;
              }
              // Ricerca robusta nelle tracce subcollection se ancora non abbiamo URL valido
              if (!candidateSrc || !isPlayableAudioUrl(candidateSrc)) {
                const wantedRaw = (currentTrack?.title || currentTrack?.name || album?.title || '').trim();
                if (wantedRaw) {
                  const wanted = normalizeTitle(wantedRaw);
                  let best = null; let bestScore = -1;
                  for (const t of artistTracks) {
                    if (currentTrack?.id && t.id && String(currentTrack.id) === String(t.id)) { best = t; bestScore = 1; break; }
                    const score = jaccardTokenSim(wanted, t.title || t.name || '');
                    if (score > bestScore) { bestScore = score; best = t; }
                  }
                  if (best && bestScore >= 0.45) {
                    const fromBest = pickBestAudioUrlFromTrack(best);
                    if (fromBest) candidateSrc = fromBest;
                  }
                }
              }
              // Se il link non è un file audio supportato, usa una piccola traccia silenziosa per attivare comunque il player globale
              // Demo fallback udibile dal bundle pubblico (finché non si configurano previewUrl reali)
              // DEMO_FALLBACK rimosso: fallback gestito internamente dal PlayerContext
              // Determina se è un URL audio diretto (informativo, non usato per scegliere il fallback qui)
              // eslint-disable-next-line no-unused-vars
              const hasPlayableAudio = isPlayableAudioUrl(candidateSrc);
              const playableSrc = hasPlayableAudio ? candidateSrc : '';
              // Niente pulsanti Spotify/Apple in pagina pubblica: i link sono usati solo per tracciamento
              const ytBtn = album.buttons?.find(b => (b.name || '').toLowerCase().includes('youtube'));
              const downloadBtn = album.buttons?.find(b => (b.name || '').toLowerCase().includes('download'));
              const isPlaying = !!(player?.state?.playing && player?.state?.src === playableSrc);
              // Conteggio pulsanti per layout (play + youtube + download/acquisto)
              const btnCount = 1 /* play */ + (ytBtn?1:0) + ((album.paymentLinkUrl || downloadBtn)?1:0);
              return (
                <div
                  key={idx}
                  className={`album-card ${isPlaying ? 'is-playing' : ''}`}
                  ref={(el) => { if (el) albumRefs.current[idx] = el; }}
                  style={{ width: 'min(92vw,560px)', background: 'rgba(30,30,30,0.92)', borderRadius: 28, boxShadow: '0 6px 32px rgba(0,0,0,0.45)', padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
                >
                  {/* Audio nascosto per avere ref PRIMA del click Play */}
                  {/* local CustomAudio removed: unified global player for persistent playback across routes */}
                  {/* 1) Cover */}
                  {album.cover && (
                    <div className="album-cover-box" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                      <div className="cover-frame cover-frame--xl" style={{ borderRadius: 24 }}>
                        <img src={album.cover} alt={album.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    </div>
                  )}
                  {/* 2) Pulsanti sotto la cover */}
                  <div className="album-buttons-row" data-count={btnCount} style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 10, flexWrap: 'nowrap' }}>
                    {(
                      <button
                        type="button"
                        className={`icon-cell icon-cell--play pulse-on-hover play-toggle-btn ${isPlaying ? 'is-active' : ''}`}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        data-label={isPlaying ? 'Pause' : 'Play'}
                        onClick={async () => {
                          // evita doppi tap in rapidissima successione
                          const nowTs = Date.now();
                          if (nowTs - (lastPlayGestureTsRef.current || 0) < 250) return;
                          lastPlayGestureTsRef.current = nowTs;
                          // no message UI
                          try {
                            let chosenSrc = playableSrc;
                            let displayTitle = hasTracks ? (currentTrack?.title || album.title) : (album.title);
                            // Fallback Apple iTunes Search se non abbiamo URL diretto
                            if (!chosenSrc) {
                              const applePreview = await fetchApplePreviewUrl(displayTitle, (artist?.nome || artist?.name || ''));
                              if (applePreview) {
                                chosenSrc = applePreview;
                              }
                            }
                            if (!chosenSrc) {
                              console.warn('[Play] Nessun URL audio valido (neanche Apple fallback) per', displayTitle);
                              return;
                            }
                            const candidate = { src: chosenSrc, title: displayTitle, cover: album.cover, artistId: (artist?.id || id), trackId: (currentTrack?.id || null) };
                            if (!player.state.playing || player.state.src !== playableSrc) {
                              await player.play(candidate);
                              tryRegisterPlayPulse();
                            } else {
                              player.pause();
                            }
                          } catch {}
                        }}
                      >
                        {isPlaying ? (
                          // Icona pausa (SVG) – colore oro coerente con tema
                          <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
                            <rect x="16" y="12" width="10" height="40" rx="2" fill="#ffd700" />
                            <rect x="38" y="12" width="10" height="40" rx="2" fill="#ffd700" />
                          </svg>
                        ) : (
                          <img src="/icons/play4.png" alt="Play" width={30} height={30} />
                        )}
                      </button>
                    )}
                    {ytBtn && <a className="icon-cell pulse-on-hover" onPointerDown={showLabelHint} href={ytBtn.link} target="_blank" rel="noopener noreferrer" aria-label="YouTube" data-label="YouTube"><img src="/icons/youtube2.png" alt="YouTube" /></a>}
                    {album.paymentLinkUrl && (
                      <a className="icon-cell icon-cell--download pulse-on-hover" onPointerDown={showLabelHint} href={album.paymentLinkUrl} target="_blank" rel="noopener noreferrer" aria-label="Buy & Download" data-label="Buy & Download" data-price={priceLabel}><img src="/icons/download5.png" alt="Buy & Download" /></a>
                    )}
                  </div>
                  {/* Rimosso blocco Ascolti dalla pagina pubblica */}
                  {/* 3) Navigazione tracce */}
                  {hasTracks && (
                    <div className="album-track-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 10, color: '#ffd700' }}>
                      <button type="button" className="nav-btn icon-cell" aria-label="Traccia precedente" onClick={() => setTrackIndexByAlbum(prev => ({ ...prev, [idx]: Math.max(0, (prev[idx] ?? 0) - 1) }))} disabled={(trackIndexByAlbum[idx] ?? 0) <= 0}>◀</button>
                      <div style={{ minWidth: 160, textAlign: 'center', padding: '4px 12px', background: '#111', border: '1px solid #444', borderRadius: 10, fontWeight: 600 }}>
                        {currentTrack?.title || `Traccia ${tIdx + 1}`}
                      </div>
                      <button type="button" className="nav-btn icon-cell" aria-label="Traccia successiva" onClick={() => setTrackIndexByAlbum(prev => ({ ...prev, [idx]: Math.min((tracks.length - 1), (prev[idx] ?? 0) + 1) }))} disabled={(trackIndexByAlbum[idx] ?? 0) >= (tracks.length - 1)}>▶</button>
                    </div>
                  )}
                  {/* Info album */}
                  <div className="cover-info" style={{ color: '#fff', marginTop: 14 }}>
                    <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span><strong>Titolo:</strong> {album.title}</span>
                      <span><strong>Anno:</strong> {album.year}</span>
                      <span><strong>Genere:</strong> {album.genre}</span>
                    </div>
                  </div>
                  {/* no audio message UI */}
                  {/* 4) Disco animato (ruota solo quando playing tramite classe is-playing) */}
                  <div className="album-disc-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 18 }}>
                    <div className="album-disc" aria-hidden="true">
                      <div className="album-disc-center" />
                      <img src={album.cover || '/disco.png'} alt="Disc" />
                      <div className="album-disc-glow" />
                    </div>
                  </div>
                  {/* Video opzionale */}
                  {album.videoUrl && !forceFallback && (
                    <div className="album-monitor crt" style={{ marginTop: 24 }}>
                      {(() => {
                        const hasErr = !!videoError[idx];
                        const monitorSrc = (!hasErr && album.videoUrl) ? album.videoUrl : null;
                        if (monitorSrc) {
                          return (
                            <video
                              ref={(el) => { if (el) { videoRefs.current[idx] = el; try { el.muted = true; el.defaultMuted = true; el.volume = 0; } catch {} } }}
                              src={monitorSrc}
                              muted
                              playsInline
                              preload="metadata"
                              controls={false}
                              onError={() => setVideoError(prev => ({ ...prev, [idx]: true }))}
                              onEnded={() => { try { videoRefs.current[idx].currentTime = 0; } catch {} }}
                            />
                          );
                        }
                        return (
                          <div className="album-monitor-fallback">
                            <div className="fallback-disc">
                              <img src={album.cover || '/disco.png'} alt="disc" />
                              <div className="fallback-center"></div>
                            </div>
                            <div className="fallback-eq"><span></span><span></span><span></span><span></span><span></span></div>
                          </div>
                        );
                      })()}
                      {album.videoUrl && !videoError[idx] && (
                        <button type="button" className="monitor-fs-fab" onClick={(e) => { e.stopPropagation(); openFullscreen(idx); }} aria-label="Apri a tutto schermo" title="Fullscreen">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 5H5v4M15 5h4v4M9 19H5v-4M15 19h4v-4" stroke="#ffd700" strokeWidth="2" strokeLinecap="round"/></svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fullscreen video overlay */}
      {showIntroForIdx !== null && (
        <div className="monitor-fs-overlay" role="dialog" aria-modal="true" onClick={closeFullscreenSync}>
          <button type="button" className="monitor-fs-close" onClick={(e) => { e.stopPropagation(); closeFullscreenSync(); }} aria-label="Chiudi">Chiudi</button>
          <div className="monitor-fs-frame" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const idx = showIntroForIdx;
              const album = (artist.albums || [])[idx] || {};
              const hasErr = !!videoError[idx];
              const monitorSrc = (!hasErr && album.videoUrl) ? album.videoUrl : null;
              if (monitorSrc) {
                return (
                  <video
                    ref={(el) => {
                      fsVideoRef.current = el;
                      try { if (el) { el.muted = true; el.defaultMuted = true; el.volume = 0; } } catch {}
                    }}
                    src={monitorSrc}
                    muted
                    playsInline
                    preload="metadata"
                    controls
                    autoPlay
                    onLoadedMetadata={() => {
                      try {
                        const a = audioRefs.current[idx]?.element;
                        if (a && fsVideoRef.current && !Number.isNaN(a.currentTime)) {
                          fsVideoRef.current.currentTime = a.currentTime;
                        }
                      } catch {}
                    }}
                    onPlay={() => { try { audioRefs.current[idx]?.play?.(); } catch {} }}
                    onPause={() => { try { audioRefs.current[idx]?.pause?.(); } catch {} }}
                    onSeeked={() => {
                      try { const a = audioRefs.current[idx]?.element; const v = fsVideoRef.current; if (a && v && !Number.isNaN(v.currentTime)) a.currentTime = v.currentTime; } catch {}
                    }}
                    onTimeUpdate={() => {
                      try { const a = audioRefs.current[idx]?.element; const v = fsVideoRef.current; if (a && v) { const d = Math.abs((a.currentTime||0) - (v.currentTime||0)); if (d > 0.6) a.currentTime = v.currentTime || 0; } } catch {}
                    }}
                    onError={() => setVideoError(prev => ({ ...prev, [idx]: true }))}
                  />
                );
              }
              return <div style={{ color: '#fff', textAlign: 'center', padding: 20 }}>Nessun video disponibile.</div>;
            })()}
          </div>
        </div>
      )}
      {/* Steps gallery moved to bottom of ArtistDetail (one-click to open fullscreen) */}
      {artist.steps && artist.steps.length > 0 && (
        <div style={{ width: '100%', maxWidth: 980, marginTop: 40, marginBottom: 30, display:'flex', flexDirection:'column', alignItems:'center' }}>
          <h3 className="dash-section-title">Galleria</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
            {artist.steps.map((s, i) => (
              <img key={i} src={s} alt={`step-${i}`} style={{ width:160, height:200, objectFit:'cover', borderRadius:10, cursor:'pointer', boxShadow:'0 6px 16px rgba(0,0,0,0.45)' }} onClick={() => setShowStepsFsIdx(i)} />
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen portrait overlay */}
      {showPortraitFs && portraitSrc && (
        <div className="portrait-fs-overlay" role="dialog" aria-modal="true" onClick={() => setShowPortraitFs(false)}>
          <button
            type="button"
            className="portrait-fs-close"
            aria-label="Chiudi"
            onClick={(e) => { e.stopPropagation(); setShowPortraitFs(false); }}
          >Chiudi</button>
          <div className="portrait-fs-frame" onClick={(e) => e.stopPropagation()}>
            <img src={portraitSrc} alt={artist.nome || artist.name || 'Ritratto artista'} />
          </div>
        </div>
      )}

      {/* Fullscreen steps gallery overlay */}
      {showStepsFsIdx !== null && artist.steps && artist.steps.length > 0 && (
        <div className="portrait-fs-overlay" role="dialog" aria-modal="true" onClick={() => setShowStepsFsIdx(null)}>
          <button
            type="button"
            className="portrait-fs-close"
            aria-label="Chiudi"
            onClick={(e) => { e.stopPropagation(); setShowStepsFsIdx(null); }}
          >Chiudi</button>
          <div className="portrait-fs-frame" onClick={(e) => e.stopPropagation()} style={{ position:'relative' }}>
            <img src={artist.steps[showStepsFsIdx]} alt={`step-${showStepsFsIdx}`} />
            {artist.steps.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="precedente"
                  className="monitor-fs-fab"
                  style={{ left: 12, right: 'auto' }}
                  onClick={() => setShowStepsFsIdx(i => (i - 1 + artist.steps.length) % artist.steps.length)}
                >◀</button>
                <button
                  type="button"
                  aria-label="successiva"
                  className="monitor-fs-fab"
                  style={{ right: 12, left: 'auto' }}
                  onClick={() => setShowStepsFsIdx(i => (i + 1) % artist.steps.length)}
                >▶</button>
              </>
            )}
          </div>
        </div>
      )}

      <SocialMinimal style={{ marginTop: 40 }} />
      <Footer />
    </div>
  );
}