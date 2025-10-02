import React, { useEffect, useRef, useState } from 'react';

/**
 * FullscreenVideoOverlay
 * Props:
 *  - show: boolean (render overlay if true)
 *  - src: string (video URL)
 *  - onClose: function () => void
 *  - loop: boolean (default true)
 *  - attemptUnmuted: boolean (default true) try autoplay with audio first
 *  - objectFit: string (default 'cover')
 *  - zIndex: number (default 9999)
 *  - className: optional additional class
 *  - backdropStyle: inline style merge for backdrop
 *  - videoStyle: inline style merge for video
 *  - controls: boolean (default true)
 *  - showCloseButton: boolean (default true)
 *  - showToggleAlways: boolean (default true) show audio toggle even if not forced muted
 */
export default function FullscreenVideoOverlay({
  show,
  src,
  onClose,
  loop = true,
  attemptUnmuted = true,
  objectFit = 'cover',
  zIndex = 9999,
  className = '',
  backdropStyle = {},
  videoStyle = {},
  controls = true,
  showCloseButton = true,
  showToggleAlways = true
}) {
  const videoRef = useRef(null);
  const [forceMuted, setForceMuted] = useState(false);
  const [ready, setReady] = useState(false);
  const triedRef = useRef(false);

  // Attempt autoplay (unmuted first, fallback to muted)
  useEffect(() => {
    if (!show || !src) return;
    const v = videoRef.current;
    if (!v) return;
    const preferAudio = attemptUnmuted;
    const previouslyUnlocked = typeof window !== 'undefined' && localStorage.getItem('ar_audio_unlocked') === '1';

    const tryPlay = (wantAudio) => {
      if (!v) return;
      try {
        v.muted = !wantAudio;
        v.volume = wantAudio ? 1 : 0;
        const p = v.play();
        if (p && p.then) {
          p.then(() => {
            if (wantAudio) {
              setForceMuted(false);
              if (typeof window !== 'undefined') localStorage.setItem('ar_audio_unlocked', '1');
            } else {
              setForceMuted(true);
            }
            setReady(true);
          }).catch(() => {
            if (wantAudio) {
              // Retry muted
              tryPlay(false);
            } else {
              setForceMuted(true);
              setReady(true);
            }
          });
        }
      } catch (e) {
        if (wantAudio) {
          tryPlay(false);
        } else {
          setForceMuted(true);
          setReady(true);
        }
      }
    };

    // Decide initial attempt
    if ((preferAudio || previouslyUnlocked) && !triedRef.current) {
      triedRef.current = true;
      tryPlay(true);
    } else if (!triedRef.current) {
      triedRef.current = true;
      tryPlay(false);
    }
  }, [show, src, attemptUnmuted]);

  if (!show || !src) return null;

  const toggleAudio = (e) => {
    e.stopPropagation();
    const v = videoRef.current; if (!v) return;
    if (v.muted) {
      try { v.muted = false; v.volume = 1; v.play().then(() => { setForceMuted(false); if (typeof window !== 'undefined') localStorage.setItem('ar_audio_unlocked', '1'); }).catch(()=>{}); } catch {}
    } else {
      v.muted = true; v.volume = 0; setForceMuted(true);
    }
  };

  return (
    <div
      className={`fullscreen-backdrop ${className}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, ...backdropStyle }}
      onClick={onClose}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        loop={loop}
        controls={controls}
        style={{ width: '100vw', height: '100vh', objectFit, background: '#000', ...videoStyle }}
        onClick={(e) => e.stopPropagation()}
      />
      {/* Audio toggle button */}
      {(showToggleAlways || forceMuted) && (
        <button
          onClick={toggleAudio}
          aria-label={forceMuted ? 'Attiva audio' : 'Disattiva audio'}
          title={forceMuted ? 'Attiva audio' : 'Disattiva audio'}
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            background: 'rgba(0,0,0,0.55)',
            color: '#ffd700',
            border: '1px solid #ffd700',
            padding: '10px 14px',
            borderRadius: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 12px #000',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: zIndex + 2
          }}
          onMouseDown={(e)=> e.stopPropagation()}
        >
          <span style={{ fontSize: 18 }}>{forceMuted ? '🔇' : '🔊'}</span>
          <span style={{ fontSize: 14 }}>{forceMuted ? 'Audio Off' : 'Audio On'}</span>
        </button>
      )}
      {showCloseButton && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          aria-label="Chiudi"
          style={{ position: 'absolute', top: 24, right: 32, fontSize: 32, color: '#ffd700', background: 'none', border: 'none', cursor: 'pointer', zIndex: zIndex + 2 }}
        >
          ×
        </button>
      )}
    </div>
  );
}
