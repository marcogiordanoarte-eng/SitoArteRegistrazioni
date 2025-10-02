import React, { useEffect, useRef } from 'react';

/**
 * AssistantWaveform
 * Visual replacement for the previous hologram avatar: an animated, reactive waveform.
 * Props:
 *  - size: number (square size in px)
 *  - speaking: boolean (active playback of voice)
 *  - listening: boolean (recording / speech recognition active)
 *  - onClick: handler
 * Implementation notes:
 *  - Uses a set of vertical bars whose heights are animated via requestAnimationFrame.
 *  - When speaking: bars dance with moderately randomized amplitudes.
 *  - When listening: bars pulse uniformly to indicate capture state.
 *  - Idle: subtle low amplitude breathing animation.
 *  - Colors shift using a CSS gradient + hue-rotation animation while speaking.
 */
export default function AssistantWaveform({ size = 100, speaking = false, listening = false, active = true, level = null, onClick, onLongPress }) {
  const barsRef = useRef([]);
  const rafRef = useRef(null);
  const phaseRef = useRef(0);
  const lastSpeakRef = useRef(false);

  useEffect(() => {
    const barCount = barsRef.current.length;
    function animate() {
      phaseRef.current += 0.04; // base phase
      const phase = phaseRef.current;
      for (let i = 0; i < barCount; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        // normalized position across bars (centered)
        const center = (i - (barCount - 1) / 2) / ((barCount - 1) / 2);
        const baseEnvelope = Math.cos(center * Math.PI * 0.65); // 0..1 envelope emphasising center
        let amp;
        // Base amplitude decision order: external level -> speaking -> listening -> idle
        if (typeof level === 'number' && level > 0) {
          // Rimappiamo RMS (0..~0.5 tipico) in range dinamico
          const dyn = Math.min(1, level * 2.2); // amplifica
          const wobble = (Math.sin(phase * 5 + i * 0.9) + 1) / 2 * 0.4 + 0.6;
          amp = baseEnvelope * dyn * wobble;
        } else if (speaking) {
          // Stronger random + rhythmic modulation
            const rand = (Math.sin(phase * 4 + i * 1.3) + 1) / 2; // 0..1
            const jitter = Math.random() * 0.35 + 0.65; // 0.65..1
            amp = baseEnvelope * rand * jitter;
        } else if (listening) {
          // Uniform pulsing indicating recording
          const pulse = (Math.sin(phase * 3) + 1) / 2; // 0..1
          amp = baseEnvelope * (0.4 + pulse * 0.55);
        } else {
          // Idle breathing low amplitude
          const breathe = (Math.sin(phase * 1.2 + i * 0.35) + 1) / 2;
          amp = baseEnvelope * 0.18 + breathe * 0.1;
        }
        const heightPct = Math.max(4, Math.min(100, amp * 100));
        el.style.setProperty('--bar-h', heightPct + '%');
        if (typeof level === 'number' && level > 0) {
          // Colore dinamico in base al livello (0 -> blu/verde, 1 -> magenta/arancio)
          const hue = 180 + Math.round(120 * (1 - Math.min(1, level)));
          el.style.setProperty('--bar-hue', hue);
        } else if (speaking) {
          const hue = 180 + ((i * 11 + phase * 40) % 150);
          el.style.setProperty('--bar-hue', Math.round(hue));
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [speaking, listening]);

  // When speaking toggles off -> gently collapse bars (one-shot)
  useEffect(() => {
    if (lastSpeakRef.current && !speaking) {
      barsRef.current.forEach((el, idx) => {
        if (!el) return;
        const delay = idx * 12;
        setTimeout(() => { el.style.setProperty('--bar-h', '10%'); }, delay);
      });
    }
    lastSpeakRef.current = speaking;
  }, [speaking]);

  const longPressRef = useRef(null);
  const pressedRef = useRef(false);
  // Long press handling (for invoking recording UI)
  function handlePointerDown(e) {
    pressedRef.current = true;
    longPressRef.current = setTimeout(() => {
      if (pressedRef.current) {
        onLongPress && onLongPress(e);
      }
    }, 620);
  }
  function handlePointerUp() {
    pressedRef.current = false;
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }

  const barCount = 21; // more density & symmetry
  const barWidth = Math.max(2, Math.round((size * 0.6) / barCount));
  const barGap = Math.max(1, Math.round(barWidth * 0.5));

  return (
    <div
      className={`assistant-waveform ${speaking ? 'speaking' : ''} ${listening ? 'listening' : ''} ${active ? 'active' : 'inactive'}`}
      role="button"
      aria-label="Assistente vocale"
      tabIndex={0}
      onClick={onClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      style={{ width: size + 'px', height: size + 'px' }}
    >
      <style>{`
        .assistant-waveform { position:relative; cursor:pointer; user-select:none; display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow:0 0 18px rgba(0,220,255,0.55), 0 0 4px rgba(0,220,255,0.7) inset; background:radial-gradient(circle at 50% 38%, rgba(0,120,160,0.35), rgba(0,40,70,0.6)); border:1px solid rgba(0,224,255,0.35); transition:box-shadow .5s ease, background .7s ease, filter .6s ease; overflow:hidden; }
        .assistant-waveform::before { content:''; position:absolute; inset:0; border-radius:50%; background:conic-gradient(from 0deg, #00e0ff, #00ffc8, #00b7ff, #00e0ff); opacity:.25; mix-blend-mode:screen; filter:blur(12px); animation:aw-rotate 8s linear infinite; }
        .assistant-waveform.speaking { box-shadow:0 0 34px rgba(0,240,255,0.9), 0 0 4px rgba(0,240,255,0.95) inset; }
        .assistant-waveform.listening { box-shadow:0 0 30px rgba(255,80,120,0.85), 0 0 6px rgba(255,80,120,0.9) inset; }
        .assistant-waveform.inactive { filter:grayscale(.8) brightness(.6); box-shadow:0 0 10px rgba(120,120,120,0.25) inset, 0 0 2px rgba(140,140,140,0.3); background:radial-gradient(circle at 50% 45%, rgba(40,40,50,0.4), rgba(10,10,15,0.7)); }
        .assistant-waveform.inactive::before { opacity:0.05; animation:none; }
        .assistant-waveform .aw-bars { position:relative; display:flex; align-items:flex-end; justify-content:center; height:70%; width:70%; }
        .assistant-waveform .aw-bar { --bar-h: 14%; --bar-hue: 180; height:var(--bar-h); width:${barWidth}px; margin:0 ${barGap/2}px; background:linear-gradient(180deg, hsl(var(--bar-hue) 95% 62%), hsl(calc(var(--bar-hue) + 35) 90% 48%)); border-radius:${Math.max(2, Math.round(barWidth/2))}px; opacity:.92; transform:translateZ(0); transition:height .22s ease, background .4s ease, filter .5s ease; box-shadow:0 0 4px hsla(var(--bar-hue) 95% 60% / .55), 0 0 10px hsla(calc(var(--bar-hue) + 40) 95% 55% / .35); }
        .assistant-waveform.idle .aw-bar { opacity:.55; }
        .assistant-waveform.speaking .aw-bar { animation:aw-flicker 1.4s ease-in-out infinite; }
        .assistant-waveform.listening .aw-bar { background:linear-gradient(180deg, #ff6fa5, #ff3d6d); }
        @keyframes aw-flicker { 0%,100% { filter:drop-shadow(0 0 2px rgba(0,255,248,0.55)); } 50% { filter:drop-shadow(0 0 6px rgba(0,255,230,0.95)); } }
        @keyframes aw-rotate { 0% { transform:rotate(0deg);} 100% { transform:rotate(360deg);} }
        .assistant-waveform:focus { outline:2px solid #00d2ff; outline-offset:3px; }
        .assistant-waveform:hover { background:radial-gradient(circle at 50% 38%, rgba(0,200,255,0.45), rgba(0,40,70,0.65)); }
        .assistant-waveform.speaking::before { opacity:.42; filter:blur(10px) brightness(1.1); animation-duration:4.2s; }
        .assistant-waveform.listening::before { opacity:.5; background:conic-gradient(from 0deg, #ff2f6d, #ffa4c5, #ff2f6d); animation-duration:5s; }
        .assistant-waveform.inactive .aw-bar { background:linear-gradient(180deg, #555, #2a2a2a); box-shadow:none; }
        .assistant-waveform.inactive:hover { filter:grayscale(.4) brightness(.85); }
      `}</style>
      <div className="aw-bars" aria-hidden="true">
        {Array.from({ length: barCount }).map((_, i) => (
          <div
            key={i}
            ref={el => { barsRef.current[i] = el; }}
            className="aw-bar"
            style={{ animationDelay: (i * 0.05) + 's' }}
          />
        ))}
      </div>
    </div>
  );
}
