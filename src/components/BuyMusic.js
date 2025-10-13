import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from './NavBar';
import YouTubeButton from './YouTubeButton';
import Footer from './Footer';
import BrandButton from './BrandButton';
import './Artisti.css';
import { db, PROJECT_ID } from './firebase';
import { collection, doc, onSnapshot, onSnapshot as onDocSnapshot } from 'firebase/firestore';

export default function BuyMusic() {
  // Admin-only draft states removed (not used on public page)

  const [genres, setGenres] = useState([]); // [{id, name, coverUrl}]
  const [genresError, setGenresError] = useState('');
  const logoCandidates = useMemo(() => [
    '/soundslogo.jpg', '/soundslogo.jpeg', '/icons/soundslogo.jpg', '/icons/soundslogo.jpeg',
    '/sounds.png', '/sounds.svg', '/sounds.jpg', '/sounds.jpeg',
    '/sounds-logo.png', '/sounds_logo.png', '/logo-sounds.png', '/sounds/logo.png',
    '/img/sounds.png', '/img/sounds-logo.png',
    '/icons/sounds.jpg', '/icons/sounds.jpeg', '/icons/sounds.png', '/icons/sounds.svg',
    '/icons/sounds-logo.jpg', '/icons/sounds-logo.png', '/icons/logo-sounds.png'
  ], []);
  const [logoIdx, setLogoIdx] = useState(0);
  const [soundsLogoUrl, setSoundsLogoUrl] = useState('');
  const [buyIntroIt, setBuyIntroIt] = useState('');
  const [buyIntroEn, setBuyIntroEn] = useState('');
  const [showEn, setShowEn] = useState(false);
  // Nessun audio/intro AI su questa pagina

  useEffect(() => {
    const unsub = onDocSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setSoundsLogoUrl(data?.soundsLogoUrl || '');
      setBuyIntroIt(data?.buyIntroIt || '');
      setBuyIntroEn(data?.buyIntroEn || '');
    });
    return () => unsub();
  }, []);

  // Intro vocale rimossa

  // Load genres in realtime
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'buyGenres'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordine per inserimento: createdAt asc; i mancanti finiscono in fondo
        list.sort((a, b) => {
          const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
          const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
          return ams - bms;
        });
        setGenres(list);
        setGenresError('');
      },
      (err) => {
        console.error('[BuyMusic] Errore lettura generi:', err);
        setGenresError(err?.message || String(err));
      }
    );
    return () => unsub();
  }, []);

  const navigate = useNavigate();
  const openGenre = (gid) => navigate(`/buy/genre/${gid}`);

  return (
    <div>
      {/* Pagina Buy Music */}
      <div className="publicsite-bg page-buymusic">
        <Link to="/login" className="dash-badge">Dashboard</Link>
        <div className="logo-wrapper">
          <div className="logo-stack">
            <div>
              <img src="/disco.png" alt="Disco" className="disco-img" />
              <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
            </div>
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
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10, marginBottom: 12 }}>
            {logoIdx < logoCandidates.length ? (
              <img
                src={logoCandidates[logoIdx]}
                alt="Sounds - Arte Registrazioni"
                onError={() => setLogoIdx(i => (i + 1 <= logoCandidates.length ? i + 1 : i + 1))}
                style={{ width: 240, maxWidth: '70vw', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.55))' }}
              />
            ) : soundsLogoUrl ? (
              <img src={soundsLogoUrl} alt="Sounds - Arte Registrazioni" style={{ width: 240, maxWidth: '70vw', height: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.55))' }} />
            ) : (
              <div style={{ fontSize: 'clamp(1.6rem, 4.5vw, 2.4rem)', color: '#ffd700', fontWeight: 800, textShadow: '0 0 12px rgba(255,215,0,0.5)' }}>
                Sounds
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 16 }}>
            <div style={{ margin: '8px 0' }}>
              <p className="publicsite-desc" style={{ margin: '4px 0', fontSize: 'clamp(1.15rem, 2.8vw, 1.7rem)', lineHeight: 1.5, textAlign: 'center', maxWidth: 980 }}>
                {buyIntroIt || 'In collaborazione con "Sounds" di Arte Registrazioni qui trovi brani di musica royalty‑free da acquistare e utilizzare a piacimento; una volta acquistato un brano, diventa di tua proprietà e non sarà più possibile acquistarlo ulteriormente. Scopri il tuo sound perfetto: scegli un genere musicale, ascolta un’anteprima di 15 secondi e acquista il brano che ti conquista! Sei un videomaker, YouTuber o un creator di reels, post social e podcast? Cerchi relax per dormire meglio o meditare? Qui puoi acquistare, scaricare e sfruttare musica royalty‑free per ogni tua avventura creativa!'}
              </p>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowEn(v => !v)}
                  aria-expanded={showEn}
                  aria-controls="buy-intro-en"
                  style={{
                    background: 'transparent',
                    color: '#ffd700',
                    border: '1px solid #ffd700',
                    borderRadius: 10,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    boxShadow: '0 0 8px rgba(255,215,0,0.25)'
                  }}
                  title={showEn ? 'Nascondi traduzione inglese' : 'Mostra traduzione inglese'}
                >
                  {showEn ? 'Nascondi traduzione inglese' : 'Mostra traduzione inglese'}
                </button>
              </div>
            </div>
            {showEn && (
              <div id="buy-intro-en" style={{ margin: '8px 0' }}>
                <p className="publicsite-desc" style={{ margin: '4px 0', opacity: 0.95, fontSize: 'clamp(1.15rem, 2.8vw, 1.7rem)', lineHeight: 1.5, textAlign: 'center', maxWidth: 980 }}>
                  {buyIntroEn || 'In collaboration with "Sounds" by Arte Registrazioni, here you can find royalty‑free music tracks to purchase and use as you wish. Once a track has been purchased, it becomes your property and can no longer be purchased by others. Discover your perfect sound: choose a music genre, listen to a 15‑second preview, and buy the track that wins you over! Are you a videomaker, YouTuber, or a creator of reels, social posts, and podcasts? Looking for relaxation to sleep better or meditate? Here you can purchase, download, and make the most of royalty‑free music for every creative adventure!'}
                </p>
              </div>
            )}
          </div>
          <h1 className="publicsite-title">Buy Music</h1>
          <div className="publicsite-desc" style={{ maxWidth: 980, margin: '8px auto 14px', textAlign: 'center' }}>
            <strong>Come funziona</strong>: scegli un genere, ascolta l’anteprima di 15s e acquista il brano che preferisci. I prezzi sono indicati accanto ad ogni brano (esempi: € 1,99 singolo, € 9,99 album, € 100 pacchetto). Dopo il pagamento ottieni il download immediato e la licenza d’uso. Per provare una pagina di pagamento funzionante, apri <Link to="/pagamento-esempio" style={{ color: '#ffd700', textDecoration: 'underline' }}>questa demo</Link>.
          </div>
          {genres.length === 0 ? (
            <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 24 }}>
              Nessun genere disponibile al momento.
              {process.env.NODE_ENV !== 'production' && (
                <div style={{ marginTop: 10, color: '#bbb', fontSize: 13 }}>
                  {genresError ? (
                    <>
                      <div>Errore Firestore: {genresError}</div>
                      <div>Controlla le regole di sicurezza e che la collezione "buyGenres" esista.</div>
                    </>
                  ) : (
                    <div>Nessun documento letto (collezione vuota o problemi di permessi).</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="buy-genres-grid">
              {genres.map(g => {
                const coverSrc = g.coverUrl || g.cover || g.coverImage || g.cover_image || g.imageUrl || g.image || '/logo.png';
                return (
                <div key={g.id} className="buy-genre-card" onClick={() => openGenre(g.id)}>
                  <div
                    className="buy-genre-cover-wrap"
                    style={{
                      backgroundImage: `url(${coverSrc})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: '#111',
                      border: '1px solid #222'
                    }}
                  >
                    <img
                      src={coverSrc}
                      alt={g.name || 'Genere'}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => { if (e.currentTarget.src !== window.location.origin + '/logo.png') { e.currentTarget.src = '/logo.png'; } }}
                    />
                  </div>
                  <div className="buy-genre-name">{g.name || 'Genere'}</div>
                  {process.env.NODE_ENV !== 'production' && (
                    <div style={{ color:'#999', fontSize:12, marginTop:6, wordBreak:'break-all' }}>
                      URL cover: {coverSrc}
                      {g?.name ? null : <div style={{color:'#c66'}}>ATTENZIONE: questo documento non ha il campo <code>name</code></div>}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
          {process.env.NODE_ENV !== 'production' && (
            <div style={{ marginTop: 16, color:'#aaa', fontSize: 12, background:'#121212', border:'1px solid #222', padding:10, borderRadius:8 }}>
              Debug generi: count={genres.length} {genres.length>0 && (<>
                <div>Titoli: {genres.map(g => g.name || '(senza nome)').join(', ')}</div>
              </>)}
              <div>Firebase projectId: {PROJECT_ID}</div>
            </div>
          )}
        </div>
        {/* Anteprima audio non presente in questa lista */}
        <div className="youtube-under-menu">
          <YouTubeButton small layout="row" />
        </div>
        <div style={{ marginTop:24, display:'flex', justifyContent:'center' }}>
          <BrandButton />
        </div>
        <Footer showArteButton={false} />
      </div>
    </div>
  );
}