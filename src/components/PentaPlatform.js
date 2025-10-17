import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Simple platformer on a grand staff: 10 horizontal lanes. Jumping triggers a note.
export default function PentaPlatform() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const audioRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [lane, setLane] = useState(5); // 0..9 (0 top)
  const [speed] = useState(120); // px/sec background scroll
  const [score, setScore] = useState(0);
  const stateRef = useRef({ lane: 5, t: 0, scroll: 0 });
  // no key state ref needed for this simple controller

  useEffect(() => {
    stateRef.current.lane = lane;
  }, [lane]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { moveLane(-1); }
      if (k === 'ArrowDown' || k === 's' || k === 'S') { moveLane(1); }
      if (k === 'p' || k === 'P') { setRunning(r => !r); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      const W = cvs.width = cvs.clientWidth; // auto-fit
      const H = cvs.height = Math.max(360, Math.floor(cvs.clientHeight || 420));
      const margin = 40;
      const lanes = 10;
      const gap = (H - margin * 2) / (lanes - 1);
      if (running) {
        stateRef.current.scroll += (speed * dt);
        stateRef.current.t += dt;
      }
      // background
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(0, 0, W, H);
      // staff lines
      ctx.strokeStyle = 'rgba(255,215,0,0.35)';
      ctx.lineWidth = 1.5;
      const offset = stateRef.current.scroll % 40;
      for (let i = 0; i < lanes; i++) {
        const y = margin + i * gap;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        // bar lines scrolling left
        for (let x = W - offset; x > 0; x -= 160) {
          ctx.beginPath();
          ctx.moveTo(x, y - gap / 2);
          ctx.lineTo(x, y + gap / 2);
          ctx.stroke();
        }
      }
      // character at fixed x
      const cx = Math.floor(W * 0.25);
      const cy = margin + stateRef.current.lane * gap;
      // stick figure
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.2;
      // head
      ctx.beginPath();
      ctx.arc(cx, cy - 14, 8, 0, Math.PI * 2);
      ctx.fill();
      // body
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6);
      ctx.lineTo(cx, cy + 14);
      ctx.stroke();
      // arms
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.stroke();
      // legs
      ctx.beginPath();
      ctx.moveTo(cx, cy + 14);
      ctx.lineTo(cx - 8, cy + 26);
      ctx.moveTo(cx, cy + 14);
      ctx.lineTo(cx + 8, cy + 26);
      ctx.stroke();

      // HUD
      ctx.fillStyle = '#9fe8c4';
      ctx.font = '14px monospace';
      ctx.fillText(`Punteggio: ${score}`, 10, 18);
      ctx.fillText(running ? 'In gioco (P per Pausa)' : 'In pausa (P per Avviare)', 10, 36);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, speed, score]);

  function ensureAudio() {
    if (!audioRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioRef.current = ctx;
    }
    return audioRef.current;
  }

  // 10-lane note map: grand staff-ish (C4..E5 approx)
  const laneToNoteHz = (l) => {
    const freqs = [
      659.25, // E5
      622.25, // D#5
      587.33, // D5
      554.37, // C#5
      523.25, // C5
      493.88, // B4
      440.00, // A4
      392.00, // G4
      349.23, // F4
      329.63, // E4
    ];
    const idx = Math.max(0, Math.min(9, l));
    return freqs[idx];
  };

  function playNoteForLane(l) {
    const ctx = ensureAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = laneToNoteHz(l);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.9, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // short piano-like pluck
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.4);
  }

  function moveLane(delta) {
    const prev = stateRef.current.lane;
    const next = Math.max(0, Math.min(9, prev + delta));
    if (next !== prev) {
      stateRef.current.lane = next;
      setLane(next);
      setScore(s => s + 1);
      try { playNoteForLane(next); } catch {}
    }
  }

  return (
    <div className="publicpage" style={{ padding: '18px 12px', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <button
        onClick={() => navigate(-1)}
        aria-label="Torna indietro"
        title="Indietro"
        style={{ position:'fixed', top:'12px', left:'12px', zIndex:100002, background:'rgba(0,0,0,0.55)', border:'1px solid #ffd700', color:'#ffd700', borderRadius:'50%', width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 0 12px #000' }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      {/* Always show logo for brand consistency */}
      <div className="logo-wrapper" style={{ position:'relative', marginBottom: 10 }}>
        <div className="logo-stack">
          <img src="/disco.png" alt="Disco" className="disco-img" />
          <img src="/logo.png" alt="Logo Arte Registrazioni" className="logo-img" />
        </div>
      </div>
      <h1 className="publicsite-title" style={{ marginBottom: 6 }}>Pentagramma Runner</h1>
      <p style={{ color: '#9fe8c4', marginTop: 0, marginBottom: 12 }}>Salta tra i righi: ogni salto suona una nota. Tasti: Frecce su/giù o SPAZIO. P = Pausa</p>
      {!running && (
        <button className="dash-small-btn" onClick={() => { ensureAudio()?.resume?.(); setRunning(true); }}>Start</button>
      )}
      {running && (
        <button className="dash-small-btn" onClick={() => setRunning(false)} style={{ marginBottom: 8 }}>Pausa</button>
      )}
      <div style={{ width:'min(96vw, 980px)', height: 420, border:'1px solid rgba(255,215,0,0.25)', borderRadius: 12, overflow:'hidden', background:'rgba(0,0,0,0.35)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      {/* Mobile controls */}
      <div style={{ display:'flex', gap: 10, marginTop: 10 }}>
        <button className="dash-small-btn" onClick={() => moveLane(-1)}>Su ▲</button>
        <button className="dash-small-btn" onClick={() => moveLane(1)}>Giù ▼</button>
      </div>
    </div>
  );
}
