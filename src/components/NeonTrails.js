import React, { useEffect, useMemo, useRef, useState } from 'react';

// Overlay con scie curve tipo circuito stampato: più luminose, più veloci e dietro a tutto
export default function NeonTrails({
  spawnEveryMs = 500,
  burst = [2, 4],
  palette = ['#00ffff', '#39ff14', '#ffd700', '#ff00aa'],
  speedRangeMs = [1500, 2800]
}) {
  const [paths, setPaths] = useState([]);
  const idRef = useRef(0);

  function rand(min, max) { return Math.random() * (max - min) + min; }

  // Genera una path SVG con curve (quadratiche) che attraversano la viewport
  const makePath = () => {
    const id = idRef.current++;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const startEdge = Math.random();
    // Partenze ai bordi per look "direzionale"
    let x0, y0;
    if (startEdge < 0.25) { x0 = 0; y0 = rand(0, h); }
    else if (startEdge < 0.5) { x0 = w; y0 = rand(0, h); }
    else if (startEdge < 0.75) { x0 = rand(0, w); y0 = 0; }
    else { x0 = rand(0, w); y0 = h; }
    // Genera 3-5 curve morbide
    const segs = Math.floor(rand(3, 6));
    let d = `M ${x0} ${y0}`;
    let px = x0, py = y0;
    for (let i = 0; i < segs; i++) {
      const cx = rand(0, w), cy = rand(0, h);
      const nx = rand(0, w), ny = rand(0, h);
      d += ` Q ${cx} ${cy} ${nx} ${ny}`;
      px = nx; py = ny;
    }
    const color = palette[Math.floor(Math.random() * palette.length)];
    const dur = rand(speedRangeMs[0], speedRangeMs[1]);
    return { id, d, color, dur };
  };

  useEffect(() => {
    let active = true;
    const tick = () => {
      if (!active) return;
      const count = Math.floor(rand(burst[0], burst[1] + 1));
      const batch = Array.from({ length: count }, makePath);
      setPaths(prev => [...prev, ...batch]);
      // cleanup dopo la durata massima + 200ms
      const maxDur = Math.max(...batch.map(b => b.dur));
      setTimeout(() => {
        setPaths(prev => prev.filter(p => !batch.find(b => b.id === p.id)));
      }, maxDur + 200);
      setTimeout(tick, spawnEveryMs);
    };
    const t = setTimeout(tick, 200);
    return () => { active = false; clearTimeout(t); };
  }, [spawnEveryMs, burst, palette, speedRangeMs]);

  // layer SVG a pieno schermo dietro i contenuti
  return (
    <svg className="neon-trails" aria-hidden="true" width="100%" height="100%" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}> 
      {paths.map(p => (
        <g key={p.id} style={{ animation: `neonDash ${p.dur}ms linear forwards` }}>
          <path d={p.d} fill="none" stroke={p.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 8px ${p.color}) drop-shadow(0 0 14px ${p.color})` }} />
        </g>
      ))}
    </svg>
  );
}
