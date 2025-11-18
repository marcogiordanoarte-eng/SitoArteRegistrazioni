import React from 'react';
import { registerLivePlayEvent, logPlayEvent } from './firebase';

const PlayerContext = React.createContext({
  state: { playing: false, src: '', title: '', cover: '', artistId: '', trackId: '', error: null },
  play: async (_opts) => {},
  pause: () => {},
});

export function PlayerProvider({ children }) {
  const audioRef = React.useRef(null);
  const [state, setState] = React.useState({ playing: false, src: '', title: '', cover: '', artistId: '', trackId: '', error: null });
  const lastPulseRef = React.useRef(0);
  const playStartTsRef = React.useRef(0);
  const thresholdLoggedRef = React.useRef(false);
  const lastTimeUpdateSecRef = React.useRef(0);
  const IS_TEST = typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test';

  React.useEffect(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      try { a.setAttribute('playsinline', ''); } catch {}
      try { a.style.display = 'none'; document.body.appendChild(a); } catch {}
      audioRef.current = a;
      const onPlay = () => setState(s => ({ ...s, playing: true }));
      const onPause = () => setState(s => ({ ...s, playing: false }));
      const onEnded = () => setState(s => ({ ...s, playing: false }));
      const onError = (ev) => {
        const err = a.error;
        if (err) {
          console.warn('[PlayerContext] media error', err.code, err.message || err);
        } else {
          console.warn('[PlayerContext] generic audio error', ev?.type);
        }
      };
      a.addEventListener('play', onPlay);
      a.addEventListener('pause', onPause);
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);
    }
  }, []);

  // Sanitizza URL Storage: corregge bucket errato e forza https
  function normalizeStorageUrl(u) {
    try {
      if (!u || typeof u !== 'string') return u;
      let s = u.trim();
      // sostituisci eventuale bucket errato
      s = s.replace(
        /([?&]alt=media\b.*$)|$/,
        (m) => m // no-op per mantenere la query
      ).replace(
        /\b(b=)arteregistrazioni-2025\.firebasestorage\.app\b/,
        '$1arteregistrazioni-2025.appspot.com'
      );
      // correzione alternativa per URL con path bucket
      s = s.replace(
        /\/v0\/b\/arteregistrazioni-2025\.firebasestorage\.app\//,
        '/v0/b/arteregistrazioni-2025.appspot.com/'
      );
      if (s.startsWith('http://')) s = 'https://' + s.slice(7);
      return s;
    } catch { return u; }
  }

  // Fa una HEAD per verificare esistenza e content-type prima di impostare src (evita errori 404/format)
  async function preflightAudio(url) {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (resp.ok) {
        const ct = resp.headers.get('Content-Type') || '';
        if (!/audio|octet-stream/i.test(ct)) {
          return { ok: false, status: resp.status, ct };
        }
        return { ok: true, status: resp.status, ct };
      }
      // Alcuni endpoint (preview Spotify / Apple) o oggetti Storage appena creati possono fallire HEAD.
      // Prova un GET minimale con Range per validare l'esistenza senza scaricare tutto.
      if (resp.status === 404 || resp.status === 403) {
        try {
          const tiny = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
          if (tiny.ok) {
            const ct2 = tiny.headers.get('Content-Type') || '';
            if (/audio|octet-stream/i.test(ct2)) {
              return { ok: true, status: tiny.status, ct: ct2, bypass: 'GET-range' };
            }
          }
        } catch {}
      }
      return { ok: false, status: resp.status };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  const play = React.useCallback(async ({ src, title, cover, artistId, trackId }) => {
  if (!src) { console.warn('[PlayerContext.play] src vuoto, abort'); setState({ playing: false, src: '', title: title || '', cover: cover || '', artistId: artistId || '', error: 'Sorgente audio vuota' }); return; }
    src = normalizeStorageUrl(src);
    const a = audioRef.current;
    if (!a) { console.error('[PlayerContext.play] audio element mancante'); return; }
    // Ambiente test: bypass reale playback
    if (IS_TEST) {
      setState({ playing: true, src, title: title || '', cover: cover || '', artistId: artistId || '', trackId: trackId || '', error: null });
      return;
    }
    // Preflight (soft): se fallisce ma è dominio noto di preview, bypass
    let check = await preflightAudio(src);
    const REMOTE_PREVIEW = /(p\.scdn\.co|audio-ssl\.itunes\.apple\.com|mzstatic\.com|sndcdn\.com|soundcloud\.com|amazonaws\.com|spotifycdn|spotify\.com\/track)/i;
    if (!check.ok) {
      if (REMOTE_PREVIEW.test(src)) {
        console.warn('[PlayerContext.play] preflight fallito ma dominio remoto consentito, bypass', check);
        check = { ok: true, status: check.status || 0, bypass: true };
      } else if (check.status === 404) {
        console.warn('[PlayerContext.play] 404 iniziale, retry 700ms');
        await new Promise(r => setTimeout(r, 700));
        const retry = await preflightAudio(src);
        if (!retry.ok) {
          console.warn('[PlayerContext.play] preflight ancora fallito dopo retry', retry);
          setState({ playing: false, src, title: title || '', cover: cover || '', artistId: artistId || '', error: 'Audio non trovato (404)' });
          return;
        }
        check = retry;
      } else {
        console.warn('[PlayerContext.play] preflight fallito (stop)', check);
        setState({ playing: false, src, title: title || '', cover: cover || '', artistId: artistId || '', error: 'Preflight fallito' });
        return;
      }
    }
    try {
      const changingSource = a.src !== src;
      if (changingSource) {
        try { a.pause(); } catch {}
        a.src = '';
        a.removeAttribute('src');
        a.load();
        a.src = src;
      }
      a.muted = false;
      a.volume = 1;
      console.log('[PlayerContext.play] attempt play', { src, title, cover, artistId, changingSource, check });
      let played = false;
      try {
        await a.play();
        played = true;
      } catch (e1) {
        console.warn('[PlayerContext.play] play() immediato fallito', e1?.name, e1?.message);
        // sblocco autoplay con silent wav
        const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAABAAAAACAAACaGwAAAAA';
        try { a.src = SILENT_WAV; await a.play(); } catch (e2) { console.warn('[PlayerContext.play] silent wav fallito', e2?.name, e2?.message); }
        // ripristina traccia originale
        a.src = src;
        // Secondo tentativo
        try {
          await a.play();
          played = true;
        } catch (e3) {
          console.warn('[PlayerContext.play] secondo play() fallito, preparo fallback canplay', e3?.name, e3?.message);
        }
      }
      if (!played) {
        // Fallback: attendi evento canplay o timeout
        console.log('[PlayerContext.play] attendo canplay fallback');
        try {
          await new Promise((resolve, reject) => {
            let done = false;
            const cleanup = () => {
              a.removeEventListener('canplay', onCan);
              a.removeEventListener('error', onErr);
              clearTimeout(to);
            };
            const onCan = () => {
              if (done) return; done = true; cleanup();
              a.play().then(resolve).catch(reject);
            };
            const onErr = () => {
              if (done) return; done = true; cleanup();
              reject(a.error || new Error('audio error'));
            };
            const to = setTimeout(() => {
              if (done) return; done = true; cleanup();
              reject(new Error('timeout canplay'));
            }, 4000);
            a.addEventListener('canplay', onCan);
            a.addEventListener('error', onErr);
            try { a.load(); } catch {}
          });
          played = true;
        } catch (e4) {
          console.error('[PlayerContext.play] fallback canplay fallito', e4?.name, e4?.message);
          setState({ playing: false, src, title: title || '', cover: cover || '', artistId: artistId || '', error: 'Impossibile avviare riproduzione' });
          return; // Abbandona
        }
      }
      // Stato ok
      setState({ playing: true, src, title: title || '', cover: cover || '', artistId: artistId || '', trackId: trackId || '', error: null });
      playStartTsRef.current = Date.now();
      thresholdLoggedRef.current = false;
      lastTimeUpdateSecRef.current = 0;
      // Log evento start (best effort, non blocca playback)
      logPlayEvent({ artistId: artistId || '', trackId: trackId || null, title: title || '', src, event: 'start' }).catch(err => {
        console.warn('[PlayerContext.play] logPlay start error', err?.message || err);
      });
      const now = Date.now();
      if (now - (lastPulseRef.current || 0) > 8000) {
        lastPulseRef.current = now;
        registerLivePlayEvent({ artistId: artistId || '', city: 'Roma', country: 'Italia' }).catch(err => {
          console.warn('[PlayerContext.play] pulse error', err?.message || err);
        });
      }
      console.log('[PlayerContext.play] PLAY OK (final)');
    } catch (e) {
      console.error('[PlayerContext.play] errore generale', e?.name, e?.message);
      setState({ playing: false, src, title: title || '', cover: cover || '', artistId: artistId || '', error: 'Errore generale riproduzione' });
    }
  }, []);

  // Monitor avanzamento per threshold & complete
  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    function onTimeUpdate() {
      if (!state.playing) return;
      const cur = a.currentTime || 0;
      lastTimeUpdateSecRef.current = cur;
      if (!thresholdLoggedRef.current) {
        const dur = a.duration || 0;
        const passed30s = cur >= 30;
        const passed50pct = dur > 0 && cur >= dur * 0.5;
        if (passed30s || passed50pct) {
          thresholdLoggedRef.current = true;
          logPlayEvent({ artistId: state.artistId || '', trackId: state.trackId || null, title: state.title || '', src: state.src || '', event: 'threshold', playedSec: cur, durationSec: dur || null }).catch(err => {
            console.warn('[PlayerContext] logPlay threshold error', err?.message || err);
          });
        }
      }
    }
    function onEnded() {
      if (!state.playing) return;
      const dur = a.duration || null;
      const played = lastTimeUpdateSecRef.current || a.currentTime || 0;
      logPlayEvent({ artistId: state.artistId || '', trackId: state.trackId || null, title: state.title || '', src: state.src || '', event: 'complete', playedSec: played, durationSec: dur }).catch(err => {
        console.warn('[PlayerContext] logPlay complete error', err?.message || err);
      });
    }
    a.addEventListener('timeupdate', onTimeUpdate);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTimeUpdate);
      a.removeEventListener('ended', onEnded);
    };
  }, [state.playing, state.artistId, state.trackId, state.title, state.src]);

  const pause = React.useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.pause(); } catch {}
    // Mantieni ultimi dati per possibili resume (non cancelliamo completamente info track)
    setState(s => ({ ...s, playing: false }));
  }, []);

  const value = React.useMemo(() => ({ state, play, pause }), [state, play, pause]);
  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  return React.useContext(PlayerContext);
}
