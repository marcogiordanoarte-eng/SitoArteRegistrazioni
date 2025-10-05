import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import "./Artisti.css";
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import CustomAudio from './CustomAudio';

// Utility: controlla se un URL punta a un file audio/video riproducibile direttamente
function isPlayableAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const p = url.split('?')[0].toLowerCase();
  return ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.mp4', '.webm', '.m3u8'].some(ext => p.endsWith(ext));
}

// Piccolo hint per mostrare le label (placeholder: qui non eseguiamo nulla di complesso)
function showLabelHint() { /* no-op placeholder; in futuro potresti aggiungere tooltip animati */ }

export default function ArtistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [audioUiMsg, setAudioUiMsg] = useState(null);
  const [trackIndexByAlbum, setTrackIndexByAlbum] = useState({});
  const [videoError, setVideoError] = useState({});
  const [showIntroForIdx, setShowIntroForIdx] = useState(null); // fullscreen video index
  const [showPortraitFs, setShowPortraitFs] = useState(false); // fullscreen portrait
  // Pulsanti voce reale disattivati: stati e riferimenti rimossi

  const audioRefs = useRef({});
  const videoRefs = useRef({});
  const albumRefs = useRef({});
  const fsVideoRef = useRef(null);
  const lastPlayGestureTsRef = useRef(0);
  const forceFallback = false; // switch manuale se vuoi forzare fallback video

  useEffect(() => {
    let aborted = false;
    async function load() {
      try {
        setLoading(true);
        const ref = doc(db, 'artisti', id);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error('Artista non trovato');
        if (!aborted) setArtist({ id: snap.id, ...snap.data() });
      } catch (e) {
        if (!aborted) setError(e.message || 'Errore caricamento artista');
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    if (id) load();
    return () => { aborted = true; };
  }, [id]);

  // Fullscreen handlers (CRT video)
  const openFullscreen = (albumIdx) => setShowIntroForIdx(albumIdx);
  const closeFullscreenSync = () => setShowIntroForIdx(null);

  if (loading) return <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 80 }}>Caricamento...</div>;
  if (error) return <div style={{ color: 'tomato', textAlign: 'center', marginTop: 80 }}>{error}</div>;
  if (!artist) return null;
  // Usa la QUARTA foto caricata (index 3) come ritratto principale, fallback a photo e poi alla prima.
  const portraitSrc = (artist.steps && artist.steps[3])
    ? artist.steps[3]
    : (artist.photo || (artist.steps && artist.steps[0]) || null);

  return (
    <div className="publicsite-bg artist-detail" style={{ paddingBottom: 60 }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
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
        {artist.bio && (
          <div className="bio-box" style={{ maxWidth: 860, width: 'min(92vw,860px)', marginTop: 12, lineHeight: 1.55, color: '#fcfbfb', position:'relative', paddingTop: 0 }}>
            <p className="bio-text" style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#fcfbfb', fontSize: '1.02rem' }}>{artist.bio}</p>
            <div style={{ marginTop: 14, display:'flex', gap:12, flexWrap:'wrap' }}>
              {/* Pulsanti voce reale disattivati */}
              <button
                type="button"
                onClick={() => {
                  // Quick scroll to albums / musica se presente
                  const firstAlbum = document.querySelector('.album-card');
                  if (firstAlbum) firstAlbum.scrollIntoView({ behavior:'smooth', block:'center' });
                }}
                style={{ background:'#0b3d1f', border:'1px solid #19c97d', color:'#d5ffe8', padding:'8px 14px', borderRadius:12, cursor:'pointer', fontWeight:600, fontSize:'.8rem', letterSpacing:.5 }}
              >Buy Music →
              </button>
            </div>
          </div>
        )}

        {/* Elenco dischi: nuovo ordine 1) Cover 2) Pulsanti 3) Frecce 4) Disco animato */}
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
              const candidateSrc = hasTracks ? (currentTrack?.link || '') : (playBtn?.link || '');
              const hasPlayableAudio = isPlayableAudioUrl(candidateSrc);
              const firstTrackLink = hasTracks ? (tracks[0]?.link || '') : '';
              const spotifyBtn = album.buttons?.find(b => (b.name || '').toLowerCase() === 'spotify');
              const appleBtn = album.buttons?.find(b => (b.name || '').toLowerCase().includes('apple'));
              const ytBtn = album.buttons?.find(b => (b.name || '').toLowerCase().includes('youtube'));
              const downloadBtn = album.buttons?.find(b => (b.name || '').toLowerCase().includes('download'));
              const isPlaying = !!(audioRefs.current[idx]?.element && !audioRefs.current[idx].element.paused);
              const btnCount = 1 /* play */ + (spotifyBtn?1:0) + (appleBtn?1:0) + (ytBtn?1:0) + ((album.paymentLinkUrl || album.paypalHostedButtonId || downloadBtn)?1:0);
              return (
                <div
                  key={idx}
                  className={`album-card ${isPlaying ? 'is-playing' : ''}`}
                  ref={(el) => { if (el) albumRefs.current[idx] = el; }}
                  style={{ width: 'min(92vw,560px)', background: 'rgba(30,30,30,0.92)', borderRadius: 28, boxShadow: '0 6px 32px rgba(0,0,0,0.45)', padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
                >
                  {/* Audio nascosto per avere ref PRIMA del click Play */}
                  {hasPlayableAudio && (
                    <div style={{ width: 0, height: 0, overflow: 'hidden' }}>
                      <CustomAudio
                        ref={(node) => {
                          if (node) {
                            audioRefs.current[idx] = node;
                            try {
                              const el = node.element;
                              if (el && !el._arBound) {
                                el.addEventListener('play', () => { try { setTrackIndexByAlbum(p => ({ ...p })); } catch {} });
                                el.addEventListener('pause', () => { try { setTrackIndexByAlbum(p => ({ ...p })); } catch {} });
                                el._arBound = true;
                              }
                            } catch {}
                          } else { delete audioRefs.current[idx]; }
                        }}
                        src={candidateSrc}
                        icons={{ play: '/icons/play4.png', pause: '/icons/play4.png' }}
                        showButton={false}
                      />
                    </div>
                  )}
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
                    {hasPlayableAudio ? (
                      <button
                        type="button"
                        className={`icon-cell icon-cell--play pulse-on-hover play-toggle-btn ${isPlaying ? 'is-active' : ''}`}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        data-label={isPlaying ? 'Pause' : 'Play'}
                        onPointerDown={async (e) => {
                          showLabelHint(e);
                          lastPlayGestureTsRef.current = Date.now();
                          setAudioUiMsg(null);
                          try {
                            Object.keys(audioRefs.current || {}).forEach(k => { const i = Number(k); if (i !== idx) audioRefs.current[i]?.pause?.(); });
                            const ref = audioRefs.current[idx];
                            if (ref && ref.element) {
                              try { ref.element.muted = false; ref.element.volume = 1; } catch {}
                              if (ref.element.paused) await ref.play?.(); else ref.pause?.();
                            }
                            const v = videoRefs.current[idx];
                            const ael = audioRefs.current[idx]?.element;
                            if (ael && v) {
                              v.muted = true; v.defaultMuted = true; v.volume = 0; v.currentTime = ael.currentTime || 0; if (ael.paused) v.pause(); else { try { await v.play(); } catch {} }
                            }
                          } catch (err) {
                            const name = (err && (err.name || err.code)) || '';
                            if (name === 'NotAllowedError' || name === 'AbortError') setAudioUiMsg('Se la musica non parte, disattiva silenzioso e tocca Play.');
                            else setAudioUiMsg('Errore avvio audio. Riprova.');
                          }
                        }}
                        onClick={async () => {
                          if (Date.now() - lastPlayGestureTsRef.current < 250) return; // evita doppio gesto
                          setAudioUiMsg(null);
                          try {
                            Object.keys(audioRefs.current || {}).forEach(k => { const i = Number(k); if (i !== idx) audioRefs.current[i]?.pause?.(); });
                            const ref = audioRefs.current[idx];
                            if (ref && ref.element) {
                              if (ref.element.paused) { try { ref.element.muted = false; ref.element.volume = 1; } catch {}; await ref.play?.(); }
                              else ref.pause?.();
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
                    ) : playBtn ? (
                      <a className="icon-cell icon-cell--play pulse-on-hover" onPointerDown={showLabelHint} href={playBtn.link} target="_blank" rel="noopener noreferrer" aria-label="Play" data-label="Play"><img src="/icons/play4.png" alt="Play" /></a>
                    ) : (hasTracks ? (
                      firstTrackLink ? (
                        <a className="icon-cell icon-cell--play pulse-on-hover" onPointerDown={showLabelHint} href={firstTrackLink} target="_blank" rel="noopener noreferrer" aria-label="Play" data-label="Play"><img src="/icons/play4.png" alt="Play" /></a>
                      ) : null
                    ) : null)}
                    {spotifyBtn && <a className="icon-cell pulse-on-hover" onPointerDown={showLabelHint} href={spotifyBtn.link} target="_blank" rel="noopener noreferrer" aria-label="Spotify" data-label="Spotify"><img src="/icons/spotify1.png" alt="Spotify" /></a>}
                    {appleBtn && <a className="icon-cell pulse-on-hover" onPointerDown={showLabelHint} href={appleBtn.link} target="_blank" rel="noopener noreferrer" aria-label="Apple Music" data-label="Apple Music"><img src="/icons/apple3.png" alt="Apple Music" /></a>}
                    {ytBtn && <a className="icon-cell pulse-on-hover" onPointerDown={showLabelHint} href={ytBtn.link} target="_blank" rel="noopener noreferrer" aria-label="YouTube" data-label="YouTube"><img src="/icons/youtube2.png" alt="YouTube" /></a>}
                    {album.paymentLinkUrl ? (
                      <a className="icon-cell icon-cell--download pulse-on-hover" onPointerDown={showLabelHint} href={album.paymentLinkUrl} target="_blank" rel="noopener noreferrer" aria-label="Buy & Download" data-label="Buy & Download" data-price={priceLabel}><img src="/icons/download5.png" alt="Buy & Download" /></a>
                    ) : (
                      <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top" className="icon-cell icon-cell--download pulse-on-hover" style={{ display: 'inline-flex' }} onPointerDown={showLabelHint} aria-label="Buy & Download" data-label="Buy & Download" data-price={priceLabel}>
                        <input type="hidden" name="cmd" value="_s-xclick" />
                        <input type="hidden" name="hosted_button_id" value={album.paypalHostedButtonId || (isSingle ? '5CGE5SB2DM2G2' : 'P7FKWUEHQGCFE')} />
                        <input type="hidden" name="currency_code" value="EUR" />
                        <input type="hidden" name="custom" value={`${artist.id || ''}:${idx}`} />
                        <input type="hidden" name="return" value={(typeof window !== 'undefined' ? window.location.origin : '') + `/download-confirm?cm=${encodeURIComponent(`${artist.id || ''}:${idx}`)}`} />
                        <input type="hidden" name="cancel_return" value={(typeof window !== 'undefined' ? window.location.origin : '') + '/artisti'} />
                        <button type="submit" title="Paga con PayPal" style={{ background: 'transparent', border: 'none', padding: 0, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', cursor: 'pointer' }}>
                          <img src="/icons/download5.png" alt="Buy & Download" />
                        </button>
                      </form>
                    )}
                  </div>
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
                  {/* Messaggi audio */}
                  {audioUiMsg && (
                    <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ color: '#ffe9a6', background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 10px', borderRadius: 8, fontWeight: 700 }}>{audioUiMsg}</div>
                    </div>
                  )}
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

      <div className="youtube-under-menu" style={{ marginTop: 40 }}>
        <YouTubeButton small layout="row" />
      </div>
      <Footer />
    </div>
  );
}