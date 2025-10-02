import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from "react";
import "./Artisti.css";

/**
 * CustomAudio: minimal inline audio with image Play/Pause button and a slim progress bar.
 * Props:
 * - src: string (audio URL)
 * - icons?: { play?: string; pause?: string } (paths under public/ e.g. '/icons/play.png')
 */
const CustomAudio = forwardRef(function CustomAudio({ src, icons = {}, showButton = true }, ref) {
  const audioRef = useRef(null);
  const videoRef = useRef(null); // used for HLS/MP4/WEBM playback on iOS (Safari prefers <video>)
  const unlockedRef = useRef(false);
  // Determine media kind by URL extension (best-effort). For iOS, prefer <video> for mp4/webm/m3u8
  const mediaKind = useMemo(() => {
    const result = { useVideo: false, mime: undefined };
    if (!src || typeof src !== 'string') return result;
    const q = src.indexOf('?');
    const p = (q >= 0 ? src.slice(0, q) : src).toLowerCase();
    if (p.endsWith('.m3u8')) { result.useVideo = true; result.mime = 'application/vnd.apple.mpegurl'; return result; }
    if (p.endsWith('.mp4')) { result.useVideo = true; result.mime = 'video/mp4'; return result; }
    if (p.endsWith('.webm')) { result.useVideo = true; result.mime = 'video/webm'; return result; }
    if (p.endsWith('.mp3')) { result.useVideo = false; result.mime = 'audio/mpeg'; return result; }
    if (p.endsWith('.m4a')) { result.useVideo = false; result.mime = 'audio/mp4'; return result; }
    if (p.endsWith('.aac')) { result.useVideo = false; result.mime = 'audio/aac'; return result; }
    if (p.endsWith('.wav')) { result.useVideo = false; result.mime = 'audio/wav'; return result; }
    if (p.endsWith('.ogg') || p.endsWith('.oga')) { result.useVideo = false; result.mime = 'audio/ogg'; return result; }
    // Default to audio element
    return result;
  }, [src]);

  // Helper to get current media element (audio for most formats, video for HLS)
  const getEl = useCallback(() => {
    return mediaKind.useVideo ? videoRef.current : audioRef.current;
  }, [mediaKind.useVideo]);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  const playIcon = icons.play || "/icons/play.png";
  const pauseIcon = icons.pause || "/icons/pause.png";

  useEffect(() => {
    const el = getEl();
    if (!el) return;

    const onTime = () => {
      const dur = el.duration || 0;
      const ct = el.currentTime || 0;
      setProgress(dur ? ct / dur : 0);
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onError = () => setPlaying(false);
    const onStalled = () => {
      // try a gentle resume if we expected playback
      if (!el.paused) {
        try { el.play().catch(() => {}); } catch {}
      }
    };
    const onWaiting = () => {
      if (!el.paused) {
        // small nudge for iOS buffering
        try { el.play().catch(() => {}); } catch {}
      }
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("error", onError);
    el.addEventListener("stalled", onStalled);
    el.addEventListener("waiting", onWaiting);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("error", onError);
      el.removeEventListener("stalled", onStalled);
      el.removeEventListener("waiting", onWaiting);
    };
  }, [getEl]);

  // When src changes: set source, reset progress, and keep state if we were playing
  useEffect(() => {
    const el = getEl();
    if (!el) return;
    try {
      const wasPlaying = playing;
      el.pause();
      // Reset and set source via <source> tags when possible; setting src directly as fallback
      try {
        if (el.nodeName === 'AUDIO' || el.nodeName === 'VIDEO') {
          // Remove existing <source> children
          while (el.firstChild) el.removeChild(el.firstChild);
          if (src) {
            const s = document.createElement('source');
            s.src = src;
            if (mediaKind.mime) s.type = mediaKind.mime;
            el.appendChild(s);
          }
        }
      } catch {}
      if (src) { try { el.src = src; } catch {} }
      setProgress(0);
      el.load();
      if (wasPlaying && src) {
        el.play().catch(() => {});
      }
    } catch {}
  }, [src, playing, getEl, mediaKind.mime]);

  // Pre-warm connection and metadata on first user proximity (hover/touch)
  useEffect(() => {
  const el = getEl();
    if (!el) return;
    let warmed = false;
    const prewarm = () => {
      if (warmed) return; warmed = true;
      try { el.load(); } catch {}
      // Optional: a tiny HEAD to warm up CDN/TLS; ignore failures
      try {
        const u = typeof src === 'string' ? src : '';
        if (u && u.startsWith('http')) {
          fetch(u, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
        }
      } catch {}
    };
  const host = (audioRef.current && audioRef.current.parentElement) || (videoRef.current && videoRef.current.parentElement);
    if (!host) return;
    host.addEventListener('pointerenter', prewarm, { passive: true });
    host.addEventListener('touchstart', prewarm, { passive: true });
    return () => {
      try { host.removeEventListener('pointerenter', prewarm); } catch {}
      try { host.removeEventListener('touchstart', prewarm); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, getEl]);

  // Pause other CustomAudio instances when one plays
  useEffect(() => {
    if (playing) {
      const me = getEl();
      if (window.__currentCustomAudio && window.__currentCustomAudio !== me) {
        try { window.__currentCustomAudio.pause(); } catch {}
      }
      window.__currentCustomAudio = me;
    }
  }, [playing, getEl]);

  // Try to unlock audio on iOS by resuming a WebAudio context on first user gesture
  const ensureAudioUnlocked = async () => {
    if (unlockedRef.current) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { unlockedRef.current = true; return; }
      if (!window.__globalAudioCtx) {
        window.__globalAudioCtx = new Ctx();
      }
      const ctx = window.__globalAudioCtx;
      if (ctx && ctx.state !== 'running') {
        await ctx.resume();
      }
      unlockedRef.current = true;
    } catch {
      // ignore
    }
  };

  const toggle = useCallback(() => {
    const el = getEl();
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      // Attempt unlock first
      ensureAudioUnlocked().finally(() => {
        // Ensure audible
        try { el.muted = false; el.volume = 1; } catch {}
        el.play().then(() => setPlaying(true)).catch(async (e) => {
          // On iOS NotAllowedError: try once more after unlocking
          if (e && e.name === 'NotAllowedError') {
            try { await ensureAudioUnlocked(); await el.play(); setPlaying(true); return; } catch {}
          }
          // On decode or not supported, try reload once
          if (e && (e.name === 'NotSupportedError' || e.name === 'AbortError')) {
            try { el.load(); await el.play(); setPlaying(true); return; } catch {}
          }
          // Ignore benign AbortError
          if (!e || e.name === 'AbortError') return;
        });
      });
    }
  }, [playing, getEl]);

  useImperativeHandle(ref, () => ({
    // Ensure volume and mute flags are correct on mobile Safari before play
    play: () => {
      const a = getEl();
      if (!a) return Promise.resolve();
      try { a.muted = false; a.volume = 1; } catch {}
      const p = (async () => {
        try { await ensureAudioUnlocked(); } catch {}
        try {
          return await a.play();
        } catch (e) {
          // Retry flow: load() then play()
          try { a.load(); } catch {}
          try { return await a.play(); } catch {}
          throw e;
        }
      })();
      if (p && typeof p.then === 'function') {
        return p.then(() => setPlaying(true)).catch(() => {});
      }
      setPlaying(true);
      return Promise.resolve();
    },
    pause: () => { const a = getEl(); if (a) { a.pause(); setPlaying(false); } },
    toggle,
    get element() { return getEl(); }
  }), [toggle, getEl]);

  return (
    <div className="audio-wrap">
      {/* Audio element for most formats */}
      {!mediaKind.useVideo && (
        <audio ref={audioRef} preload="auto" playsInline disableRemotePlayback>
          {src && (
            <source src={src} {...(mediaKind.mime ? { type: mediaKind.mime } : {})} />
          )}
        </audio>
      )}
      {/* Hidden inline video for HLS/MP4/WEBM playback on iOS */}
      {mediaKind.useVideo && (
        <video
          ref={videoRef}
          preload="auto"
          playsInline
          disableRemotePlayback
          // Keep it effectively hidden but present
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        >
          {src && (
            <source src={src} {...(mediaKind.mime ? { type: mediaKind.mime } : {})} />
          )}
        </video>
      )}
      {showButton && (
        <button type="button" className={`pulsing-btn audio-btn${playing ? ' is-active' : ''}`} onClick={toggle} aria-label={playing ? 'Pausa' : 'Play'}>
          <img src={playing ? pauseIcon : playIcon} alt={playing ? 'Pausa' : 'Play'} width={22} height={22} />
          <span>{playing ? 'Pausa' : 'Play'}</span>
        </button>
      )}
      <div className="audio-progress">
        <span style={{ width: `${Math.max(0, Math.min(100, progress * 100)).toFixed(2)}%` }} />
      </div>
    </div>
  );
});

export default CustomAudio;
