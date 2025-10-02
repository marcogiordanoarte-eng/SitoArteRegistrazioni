import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import PublicSite from "./PublicSite";
import DownloadConfirm from "./DownloadConfirm";
import Artisti from "./Artisti";
import ArtistDetail from "./ArtistDetail";
import Studio from "./Studio";
import Contatti from "./Contatti";
import Festival from "./Festival";
import BuyMusic from "./BuyMusic";
import Musica from "./Musica";
import BuyGenreDetail from "./BuyGenreDetail";
import Podcast from "./Podcast";
import Countdown from "./Countdown";
import Terms from "./Terms";
import Privacy from "./Privacy";
import Licenza from "./Licenza";
import PagamentoEsempio from "./PagamentoEsempio";
import Dashboard from "./Dashboard";
import Login from "./Login";
import { AuthProvider, useAuth } from "./AuthContext";
import { ADMIN_UIDS } from './config';
import AIAssistantWidget from './AIAssistantWidget';
import { useVoiceNavigator } from './useVoiceNavigator';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div style={{ color: '#ffd700', textAlign: 'center', marginTop: 80 }}>Verifica sessione...</div>;
  }
  if (!user) {
    console.info('[PrivateRoute] Nessun utente autenticato. Redirect a /login', { from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'not-auth' }} />;
  }
  if (!ADMIN_UIDS.includes(user.uid)) {
    console.warn('[PrivateRoute] Utente autenticato ma NON admin. Redirect a /login', { uid: user.uid, from: location.pathname });
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: 'not-admin' }} />;
  }
  return children;
}

export default function App() {
  // Stato risposta rapida da listener vocale globale (base, separato da widget avanzato)
  const [voiceNavReply, setVoiceNavReply] = useState('');
  const [voiceNavLastCmd, setVoiceNavLastCmd] = useState('');
  // Refs MUST be declared at top-level (non dentro useEffect) per rispettare le Rules of Hooks
  const ttsCacheRef = useRef(new Map()); // text -> dataURL
  const playingRef = useRef(null); // Audio element attivo
  const functionsModulePromiseRef = useRef(null); // memo import dinamico
  useEffect(() => {
    // Listener vocale minimale (baseline) per comandi "vai al" e scroll
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // browser non supporta
    const recognition = new SR();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    function stopCurrent(){
      try { if (playingRef.current) { playingRef.current.pause(); playingRef.current.src = ''; playingRef.current = null; } } catch {}
      if (window.speechSynthesis && window.speechSynthesis.speaking) { try { window.speechSynthesis.cancel(); } catch {} }
    }
    async function speakViaSamplesOrTTS(text){
      if (!text) return;
      const clean = text.trim();
      if (!clean) return;
      stopCurrent();
      // 1. Campioni preregistrati
      try {
        const mod = await import('./assistantVoice');
        const clips = mod.planClips(clean);
        if (clips.length) { mod.playClips(clips, {}); return; }
      } catch {}
      // 2. Cache locale (in-memory) TTS
      const cached = ttsCacheRef.current.get(clean);
      if (cached) {
        const a = new Audio(cached);
        playingRef.current = a;
        a.play().catch(()=>{});
        return;
      }
      // 3. Callable Firebase Function: ttsSynthesize (ElevenLabs proxy)
      try {
        if (!functionsModulePromiseRef.current) functionsModulePromiseRef.current = import('firebase/functions');
        const [{ getFunctions, httpsCallable }] = await Promise.all([functionsModulePromiseRef.current]);
        // Usa la app già inizializzata se disponibile globalmente (window.firebaseApp) altrimenti fallback default
        let fns;
        try {
          fns = getFunctions();
        } catch {
          fns = getFunctions(undefined, 'us-central1');
        }
        const call = httpsCallable(fns, 'ttsSynthesize');
        const { data } = await call({ text: clean });
        if (data && data.audioBase64) {
          const mime = data.mime || 'audio/mpeg';
          const url = `data:${mime};base64,${data.audioBase64}`;
          ttsCacheRef.current.set(clean, url);
          const a = new Audio(url);
          playingRef.current = a;
          a.play().catch(()=>{});
          return;
        }
      } catch (e) {
        // log silenzioso
        try { console.warn('[TTS] errore', e); } catch {}
      }
      // 4. Fallback finale: Web Speech API
      if (window.speechSynthesis) {
        try {
          const ut = new SpeechSynthesisUtterance(clean);
            ut.lang = 'it-IT'; ut.rate = 1; ut.pitch = 1; ut.volume = 1;
            window.speechSynthesis.speak(ut);
        } catch {}
      }
    }
    function scrollToId(id){
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior:'smooth', block:'start' }); return true; }
      return false;
    }
    function handleCommand(comando){
      const raw = comando.toLowerCase().trim();
      setVoiceNavLastCmd(raw);
      // Navigazione pagine
      if (raw.startsWith('vai al ') || raw.startsWith('vai alla ') || raw.startsWith('vai a ') || raw.startsWith('portami a ') || raw.startsWith('portami al ') || raw.startsWith('portami alla ')) {
        const cleaned = raw.replace(/^(vai|portami) (a |al |alla )/,'').trim();
        // alias
        const map = { artisti:'/artisti', musica:'/musica', studio:'/studio', festival:'/festival', podcast:'/podcast', countdown:'/countdown', contatti:'/contatti', home:'/', buy:'/buy', termini:'/termini', privacy:'/privacy', licenza:'/licenza' };
        if (map[cleaned]) {
          try { window.history.pushState({}, '', map[cleaned]); } catch {}
          setVoiceNavReply(`Ti porto a ${cleaned}`);
          speakViaSamplesOrTTS(`Ti porto a ${cleaned}`);
          return;
        }
        // scroll locale (es: footer)
        if (cleaned === 'footer' || cleaned === 'piè di pagina' || cleaned === 'piè' ) {
          if (scrollToId('site-footer-anchor') || scrollToId('site-footer')) {
            setVoiceNavReply('Scorro al footer');
            speakViaSamplesOrTTS('Scorro al footer');
            return;
          }
        }
        setVoiceNavReply('Sezione non trovata');
        speakViaSamplesOrTTS('Non trovo quella sezione');
        return;
      }
      // Scroll comandi
      if (/scroll( a| )?giu|scendi|più giù/.test(raw)) { window.scrollBy({ top: window.innerHeight*0.8, behavior:'smooth' }); setVoiceNavReply('Scrollo giù'); speakViaSamplesOrTTS('Scrollo giù'); return; }
      if (/scroll( a| )?su|torna su|vai su|all inizio|all’inizio/.test(raw)) { window.scrollTo({ top:0, behavior:'smooth' }); setVoiceNavReply('Torno su'); speakViaSamplesOrTTS('Torno su'); return; }
      // Fallback
      setVoiceNavReply('Non ho capito, ripeti?');
      speakViaSamplesOrTTS('Non ho capito, ripeti?');
    }
    recognition.onresult = (e) => {
      try {
        const comando = e.results[0][0].transcript;
        handleCommand(comando);
      } catch {}
    };
    recognition.onend = () => { try { recognition.start(); } catch {} };
    try { recognition.start(); } catch {}
    return () => { try { recognition.onend = null; recognition.stop(); } catch {} };
  }, []);
  useEffect(() => {
    // Inject public fonts stylesheet
    const id = 'vintaface-fonts-css';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = '/fonts/fonts.css';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    // Suppress benign media/navigation errors (AbortError, NotAllowedError) and NotSupportedError like "The operation is not supported."
    const onUnhandled = (e) => {
      try {
        const name = (e && e.reason && e.reason.name) || '';
        const msg = (e && e.reason && e.reason.message) || '';
        if (
          name === 'AbortError' ||
          name === 'NotAllowedError' ||
          name === 'NotSupportedError' ||
          (typeof msg === 'string' && (
            msg.includes('The operation was aborted') ||
            msg.includes('The operation is not supported')
          ))
        ) {
          e.preventDefault && e.preventDefault();
          return false;
        }
      } catch {}
    };
    const onError = (e) => {
      try {
        const name = (e && e.error && e.error.name) || '';
        const msg = (e && e.message) || '';
        if (
          name === 'AbortError' ||
          name === 'NotAllowedError' ||
          name === 'NotSupportedError' ||
          (typeof msg === 'string' && (
            msg.includes('The operation was aborted') ||
            msg.includes('The operation is not supported')
          ))
        ) {
          e.preventDefault && e.preventDefault();
          return false;
        }
      } catch {}
    };
    window.addEventListener('unhandledrejection', onUnhandled);
    window.addEventListener('error', onError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandled);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  useEffect(() => {
    // Hide dashboard badge on scroll down; show on scroll up or near top
    let lastY = window.scrollY || 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const delta = y - lastY;
        const badges = document.querySelectorAll('.dash-badge');
        if (badges && badges.length) {
          if (y > 80 && delta > 6) {
            badges.forEach(b => b.classList.add('dash-badge--hidden'));
          } else if (delta < -6 || y < 60) {
            badges.forEach(b => b.classList.remove('dash-badge--hidden'));
          }
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  // Component interno per gestire la visibilità/context dell'assistente "Sounds"
  function GlobalAssistant() {
    const location = useLocation();
    const path = location.pathname || '/';
    const suppressed = path.startsWith('/dashboard') || path.startsWith('/login');
    // Chiamare SEMPRE l'hook alla stessa profondità; se disabilitato passa enabled:false
    const { listening, transcript, response } = useVoiceNavigator({ enabled: !suppressed, onCommand:(info)=>{ if (window && !window.__voiceNavLog) window.__voiceNavLog=[]; try { window.__voiceNavLog.push({ t:Date.now(), ...info }); } catch {} } });
    // Mappa semplice path -> page key per prompt contestuale
    let pageKey = 'global';
    if (path === '/' || path === '/index.html') pageKey = 'home';
    else if (path.startsWith('/artista/')) pageKey = 'artist';
    else if (path === '/artisti') pageKey = 'artisti';
    else if (path.startsWith('/buy')) pageKey = 'buy';
    else if (path === '/musica') pageKey = 'musica';
    else if (path === '/studio') pageKey = 'studio';
    else if (path === '/festival') pageKey = 'festival';
    else if (path === '/podcast') pageKey = 'podcast';
    else if (path === '/countdown') pageKey = 'countdown';
    else if (path === '/contatti') pageKey = 'contatti';
    if (suppressed) return null;
    return (
      <>
        <AIAssistantWidget page={pageKey} forceWelcome={pageKey === 'home'} />
        <div style={{ position:'fixed', left:12, bottom:12, zIndex:13000, pointerEvents:'none', display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ background:'rgba(0,0,0,0.55)', color:'#bdefff', padding:'6px 10px', border:'1px solid rgba(0,200,255,0.4)', borderRadius:12, fontSize:'.6rem', maxWidth:220 }}>
            <strong style={{ color:listening? '#0ff':'#ccc' }}>{listening? '🎤 Ascolto':'🕓 Inattivo'}</strong><br/>
            {transcript && <span style={{ display:'block', opacity:.85 }}>Tu: {transcript}</span>}
            {response && <span style={{ display:'block', color:'#7fe9ff' }}>AI: {response}</span>}
          </div>
        </div>
      </>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ position:'relative', minHeight:'100vh' }}>
          <Routes>
            <Route path="/" element={<PublicSite />} />
            <Route path="/artisti" element={<Artisti />} />
            <Route path="/artista/:id" element={<ArtistDetail />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/festival" element={<Festival />} />
            <Route path="/podcast" element={<Podcast />} />
            <Route path="/countdown" element={<Countdown />} />
            <Route path="/buy" element={<BuyMusic />} />
            <Route path="/musica" element={<Musica />} />
            <Route path="/buy/genre/:gid" element={<BuyGenreDetail />} />
            <Route path="/contatti" element={<Contatti />} />
            <Route path="/termini" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/licenza" element={<Licenza />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/download-confirm" element={<DownloadConfirm />} />
            <Route path="/pagamento-esempio" element={<PagamentoEsempio />} />
          </Routes>
          <GlobalAssistant />
          {/* Output semplice listener vocale baseline */}
          {voiceNavReply && (
            <div style={{ position:'fixed', right:10, bottom:10, zIndex:14000, background:'rgba(0,0,0,0.6)', color:'#dffaff', padding:'8px 12px', border:'1px solid #00b7ff', borderRadius:12, fontSize:'.65rem', maxWidth:240 }}>
              <div style={{ opacity:.7 }}>Comando: {voiceNavLastCmd}</div>
              <strong>{voiceNavReply}</strong>
            </div>
          )}
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
