import React, { useEffect, useRef, useState } from 'react';

// Contract:
// props:
// - src (optional): video path, e.g. '/turntable-intro.mp4'
// - onFinish: called when video/animation ends
// - onSkip: called when user skips (also closes)
// - maxDurationMs: safety timeout
export default function TurntableIntro({ src = '/turntable-intro.mp4', onFinish, onSkip, maxDurationMs = 1200 }) {
  const vidRef = useRef(null);
  // Show fallback by default for immediate feedback; switch to video if it starts
  const [useFallback, setUseFallback] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let timerId;
    const done = () => {
      if (onFinish) onFinish();
    };
    // Safety timeout to ensure we never block playback
    timerId = setTimeout(done, maxDurationMs);
    return () => clearTimeout(timerId);
  }, [onFinish, maxDurationMs]);

  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const onEnded = () => onFinish && onFinish();
    const onError = () => { /* se errore, chiudi subito per non bloccare */ onFinish && onFinish(); };
    const onPlaying = () => { setUseFallback(false); setStatus(''); /* opzionale: potremmo anche chiudere subito */ };
    const onCanPlay = () => { /* anticipa chiusura appena possibile */ onFinish && onFinish(); };
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onCanPlay);
    // Prova autoplay silenzioso; in caso di blocco, chiudi subito per non ritardare
    const tryPlay = async () => {
      try {
        const p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
        if (p && typeof p.then === 'function') {
          try { await p; } catch {}
        }
        // In ogni caso, non tenere schermata: chiudi rapidamente
        setTimeout(() => onFinish && onFinish(), 200);
      } catch {
        onFinish && onFinish();
      }
    };
    tryPlay();
    return () => {
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', onError);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplay', onCanPlay);
    };
  }, [onFinish]);

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      <button type="button" className="intro-skip" onClick={() => onSkip && onSkip()} aria-label="Salta intro">Salta</button>
      {/* Nessun fallback visivo invasivo: chiudiamo appena possibile */}
      <video
        ref={vidRef}
        className="intro-video"
        src={src}
        muted
        playsInline
        style={{ display: 'none' }}
      />
    </div>
  );
}
