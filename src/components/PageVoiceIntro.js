import { useEffect, useRef, useState } from 'react';
import { loadVoiceInventory, planClips, playClips } from './assistantVoice';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Riproduce automaticamente un'introduzione vocale (solo campioni registrati) per una pagina.
// Usa sessionStorage per evitare ripetizioni nella stessa sessione browser.
export default function PageVoiceIntro({ pageKey, transcript, pageText, delayMs = 400, oncePerSession = true, resumePrevious = true }) {
  const startedRef = useRef(false);
  const [directUrl, setDirectUrl] = useState(null);
  const [unlockNeeded, setUnlockNeeded] = useState(false);
  const plannedRef = useRef(null);
  const chainRef = useRef(null);
  const directPreloadRef = useRef(null);
  const fadeRef = useRef(null);

  // Carica eventuale URL diretto configurato (site/config -> pageIntro_<pageKey>)
  useEffect(() => {
    let active = true;
    if (!pageKey) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'config'));
        if (!active) return;
        if (snap.exists()) {
          const data = snap.data() || {};
          const field = `pageIntro_${pageKey}`;
            if (data[field]) setDirectUrl(data[field]);
        }
      } catch {/* silent */}
    })();
    return () => { active = false; };
  }, [pageKey]);

  // Preload dell'audio diretto (se presente) anticipato per ridurre latenze iniziali
  useEffect(() => {
    if (!directUrl) { if (directPreloadRef.current) { try { directPreloadRef.current.src=''; } catch{}; directPreloadRef.current=null; } return; }
    const a = new Audio();
    a.preload = 'auto';
    a.src = directUrl;
    a.load(); // suggerisce caching
    directPreloadRef.current = a;
    return () => { if (directPreloadRef.current === a) directPreloadRef.current = null; };
  }, [directUrl]);

  useEffect(() => {
    if (!pageKey) return;
    if (startedRef.current) return;
    // Segnala globalmente che la page intro tenterà playback (per evitare doppi welcome)
    try { if (!window.__pageVoiceIntroActive) window.__pageVoiceIntroActive = {}; window.__pageVoiceIntroActive[pageKey] = 'pending'; } catch {}
    const versionToken = (directUrl ? 'url:' + directUrl : 'txt:' + (transcript||pageText||''))
      .replace(/\s+/g,' ') // compress
      .slice(0,180);
    if (oncePerSession) {
      try {
        const stored = sessionStorage.getItem('pvintro_' + pageKey);
        if (stored && stored.startsWith('1|')) {
          const prevVer = stored.slice(2);
          if (prevVer === versionToken) return; // stessa versione già riprodotta
        }
      } catch {}
    }
    let cancelled = false;
    const attempt = async () => {
      try {
        if (directUrl) {
          plannedRef.current = [directUrl];
          startedRef.current = true;
          // Se abbiamo preload, usiamo riproduzione manuale con fade-in per evitare skip iniziali
          const pre = directPreloadRef.current;
          if (pre && pre.src === directUrl) {
            try {
              pre.currentTime = 0;
              pre.volume = 0;
              pre.play().then(()=>{
                let step = 0; const steps = 8; const target = 1;
                fadeRef.current = setInterval(()=>{
                  step++; try { pre.volume = Math.min(target, (step/steps)*target); } catch {}
                  if (step >= steps) { clearInterval(fadeRef.current); fadeRef.current=null; }
                }, 70);
              }).catch(()=>{
                // fallback a playClips se play diretto fallisce
                chainRef.current = playClips([directUrl], { onEnd: () => { chainRef.current = null; }, resumePreviousAfter: resumePrevious });
              });
            } catch {
              chainRef.current = playClips([directUrl], { onEnd: () => { chainRef.current = null; }, resumePreviousAfter: resumePrevious });
            }
          } else {
            chainRef.current = playClips([directUrl], { onEnd: () => { chainRef.current = null; }, resumePreviousAfter: resumePrevious });
          }
          if (oncePerSession) { try { sessionStorage.setItem('pvintro_' + pageKey, '1|' + versionToken); } catch {} }
          try { window.__pageVoiceIntroActive[pageKey] = 'playing'; } catch {}
          return;
        }
        await loadVoiceInventory(db);
        if (cancelled) return;
        const primary = (transcript || '').trim();
        const secondary = (pageText || '').trim();
        let clips = [];
        if (primary) clips = planClips(primary);
        if (!clips.length && secondary && secondary !== primary) clips = planClips(secondary);
        if (!clips.length) return;
        plannedRef.current = clips;
        startedRef.current = true;
        chainRef.current = playClips(clips, { onEnd: () => { chainRef.current = null; try { window.__pageVoiceIntroActive[pageKey] = 'ended'; } catch {}; }, resumePreviousAfter: resumePrevious });
        if (oncePerSession) { try { sessionStorage.setItem('pvintro_' + pageKey, '1|' + versionToken); } catch {} }
        try { window.__pageVoiceIntroActive[pageKey] = 'playing'; } catch {}
      } catch (e) {
        // Possibile blocco autoplay
        setUnlockNeeded(true);
      }
    };
    const timer = setTimeout(() => { attempt(); }, delayMs);
    return () => { cancelled = true; clearTimeout(timer); if (chainRef.current) { chainRef.current.cancel?.(); } if (fadeRef.current) { clearInterval(fadeRef.current); fadeRef.current=null; } };
  }, [pageKey, transcript, pageText, delayMs, oncePerSession, directUrl, resumePrevious]);

  const handleUnlock = () => {
    setUnlockNeeded(false);
    if (plannedRef.current && plannedRef.current.length) {
      chainRef.current = playClips(plannedRef.current, { onEnd: () => { chainRef.current = null; }, resumePreviousAfter: resumePrevious });
    } else {
      startedRef.current = false; // forza nuova pianificazione
    }
  };
  return unlockNeeded ? (
    <button
      type="button"
      onClick={handleUnlock}
      style={{ position:'fixed', bottom:20, right:20, zIndex:99999, background:'#072d46', color:'#ffd700', border:'2px solid #00b7ff', padding:'10px 16px', borderRadius:18, fontSize:'.75rem', fontWeight:700, boxShadow:'0 0 12px rgba(0,183,255,0.55)', cursor:'pointer' }}
    >🔊 Avvia Audio</button>
  ) : null;
}
