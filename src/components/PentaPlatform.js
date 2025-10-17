import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

// Pentagramma Runner: 5 staff lines (white on black). Collect coins on lines/spaces to play notes.
export default function PentaPlatform() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search || '');
  const artistId = params.get('aid');
  const startSfxUrlQP = params.get('start');
  const overSfxUrlQP = params.get('over');
  const bg1 = params.get('bg');
  const bg2 = params.get('bg2');
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  // WebAudio context for note SFX on coin pickup
  const noteCtxRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [countdown, setCountdown] = useState(0); // 0 = no countdown; 3..1 during countdown
  const [lane, setLane] = useState(4); // 0..8 (0 top): lines and spaces
  const [speed] = useState(120); // base px/sec background scroll
  const [score, setScore] = useState(0);
  // Difficoltà fissa: 'facile'
  const difficulty = 'facile';
  const [musicPlaying, setMusicPlaying] = useState(false);
  const stateRef = useRef({
  lane: 4,
    t: 0,
    scroll: 0,
    coins: [],
    monsters: [],
    spawnAcc: 0,
    lastCollect: -1e9,
    streak: 0,
    goTime: 0, // seconds left to show "VIA!"
  });
  const fxRef = useRef({ flash: 0, shake: 0 }); // gameover FX
  // Background music player
  const [playlist, setPlaylist] = useState([]);
  const [trackIdx, setTrackIdx] = useState(0);
  const audioPlayerRef = useRef(null);
  const gameBgRef = useRef(null);
  const gameConfigRef = useRef({});
  const [preferGameConfig, setPreferGameConfig] = useState(false);
  // User-adjustable volumes (persisted locally)
  const [userLoopVol, setUserLoopVol] = useState(null); // 0..1 or null for default
  const [userSfxVol, setUserSfxVol] = useState(null); // 0..1 or null for default
  const sfxVolRef = useRef(1.0);
  const [selectedLoopUrl, setSelectedLoopUrl] = useState('');
  // no key state ref needed for this simple controller

  // Load user volume preferences from localStorage once
  useEffect(() => {
    try {
      const lv = localStorage.getItem('game.loopVol');
      if (lv !== null) setUserLoopVol(Math.max(0, Math.min(1, Number(lv))));
    } catch {}
    try {
      const sv = localStorage.getItem('game.sfxVol');
      if (sv !== null) {
        const v = Math.max(0, Math.min(1, Number(sv)));
        setUserSfxVol(v);
        sfxVolRef.current = v;
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stateRef.current.lane = lane;
  }, [lane]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { moveLane(-1); }
      if (k === 'ArrowDown' || k === 's' || k === 'S') { moveLane(1); }
      if (k === 'p' || k === 'P') { if (!gameOver && countdown === 0) setRunning(r => !r); }
      if (k === 'r' || k === 'R') { if (gameOver) restartGame(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // canvas animation loop (declared later, after callbacks)

  function ensureNoteAudio() {
    if (!noteCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      noteCtxRef.current = ctx;
    }
    return noteCtxRef.current;
  }

  // 9 positions (lines+spaces) top->bottom mapping
  const laneToNoteHz = (l) => {
    const freqs = [
      659.25, // E5 (top line)
      622.25, // D#5
      587.33, // D5
      554.37, // C#5
      523.25, // C5
      493.88, // B4
      440.0,  // A4
      392.0,  // G4
      349.23, // F4 (bottom line)
    ];
    const idx = Math.max(0, Math.min(8, l|0));
    return freqs[idx];
  };

  const playNoteForLane = useCallback((l) => {
    const ctx = ensureNoteAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = laneToNoteHz(l);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    const vol = Math.max(0, Math.min(1, sfxVolRef.current ?? 1.0));
    g.gain.linearRampToValueAtTime(0.9 * vol, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // short piano-like pluck
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.4);
  }, []);

  function moveLane(delta) {
  const prev = stateRef.current.lane;
  const next = Math.max(0, Math.min(8, prev + delta));
    if (next !== prev) {
      stateRef.current.lane = next;
      setLane(next);
      // No sound or score on lane change anymore
    }
  }

  function restartGame() {
    // reset state
    stateRef.current.t = 0;
    stateRef.current.scroll = 0;
    stateRef.current.coins = [];
    stateRef.current.monsters = [];
    stateRef.current.spawnAcc = 0;
    stateRef.current.lastCollect = -1e9;
    stateRef.current.streak = 0;
  stateRef.current.lane = 4;
  setLane(4);
    setScore(0);
    setGameOver(false);
    fxRef.current.flash = 0;
    fxRef.current.shake = 0;
    ensureNoteAudio()?.resume?.();
    countdownStart();
  }

  function countdownStart() {
    setCountdown(3);
    setRunning(false);
    // tick down via interval
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      if (n > 0) {
        setCountdown(n);
      } else {
        clearInterval(id);
        setCountdown(0);
        stateRef.current.goTime = 0.7;
        setRunning(true);
        // start cue: external url if provided, else bundled file, else jingle
        try {
          const list = Array.isArray(gameConfigRef.current.startList) ? gameConfigRef.current.startList.filter(x => x && x.enabled && x.url) : [];
          const chosenFromList = list.length > 0 ? list[Math.floor(Math.random() * list.length)]?.url : null;
          const externalStart = chosenFromList || gameConfigRef.current.startSfxUrl || startSfxUrlQP;
          if (externalStart) {
            const a = new Audio(externalStart);
            const vol = (userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0);
            a.volume = vol;
            a.play().catch(()=>{});
          } else {
            const a = new Audio('/GameSong_IntroStart.wav');
            const vol = (userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0);
            a.volume = vol;
            a.play().catch(() => { try { playStartJingle(); } catch {} });
          }
        } catch { try { playStartJingle(); } catch {} }
      }
    }, 1000);
  }

  const playGameOverJingle = useCallback(() => {
    const ctx = ensureNoteAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    const now = ctx.currentTime;
    o.frequency.setValueAtTime(196.0, now); // G3
    o.frequency.exponentialRampToValueAtTime(110.0, now + 0.35); // down
    const vol = Math.max(0, Math.min(1, sfxVolRef.current ?? 1.0));
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.8 * vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.5);
  }, []);

  const playStartJingle = useCallback(() => {
    const ctx = ensureNoteAudio();
    const g = ctx.createGain();
    const vol = Math.max(0, Math.min(1, sfxVolRef.current ?? 1.0));
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      const t0 = now + i * 0.09;
      o.frequency.setValueAtTime(f, t0);
      const eg = ctx.createGain();
      eg.gain.setValueAtTime(0, t0);
      eg.gain.linearRampToValueAtTime(0.8, t0 + 0.02);
      eg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      o.connect(eg).connect(g);
      o.start(t0);
      o.stop(t0 + 0.18);
    });
  }, []);

  // canvas animation loop
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
  const W = cvs.width = cvs.clientWidth; // auto-fit
  const H = cvs.height = Math.max(640, Math.floor(cvs.clientHeight || 720));
  const lanes = 5; // staff lines
  // Make staff look like a score: thicker lines, compact spaces
  const gap = Math.min(64, Math.max(34, Math.floor(H / 12))); // Big Mode uniform
  const staffHeight = gap * (lanes - 1);
  const top = Math.round((H - staffHeight) / 2);
  const halfGap = gap / 2; // spaces
      // Difficulty parameters
      let params;
      switch (difficulty) {
        case 'facile': // super permissivo (più veloce)
          params = {
            speedBase: 130,
            speedRamp: 4,
            spawnBase: 1.4,
            spawnSlope: 0.01,
            spawnMin: 0.75,
            monsterMin: 1,
            monsterAddPer: 35,
            monsterMax: 2,
            jitterMin: -180,
            jitterMax: 420,
            headCoinMult: 0.8,
            coinMult: 0.9,
            headMonMult: 0.32,
            monMult: 0.35,
          };
          break;
        case 'difficile': // più tosto
          params = {
            speedBase: 135,
            speedRamp: 7,
            spawnBase: 0.8,
            spawnSlope: 0.025,
            spawnMin: 0.35,
            monsterMin: 3,
            monsterAddPer: 12,
            monsterMax: 7,
            jitterMin: -40,
            jitterMax: 220,
            headCoinMult: 0.45,
            coinMult: 0.45,
            headMonMult: 0.6,
            monMult: 0.6,
          };
          break;
        default: // "normale" ma molto facile
          params = {
            speedBase: 105,
            speedRamp: 2.5,
            spawnBase: 1.2,
            spawnSlope: 0.012,
            spawnMin: 0.65,
            monsterMin: 1,
            monsterAddPer: 28,
            monsterMax: 3,
            jitterMin: -160,
            jitterMax: 400,
            headCoinMult: 0.75,
            coinMult: 0.85,
            headMonMult: 0.38,
            monMult: 0.4,
          };
      }
      const effSpeed = params.speedBase + score * params.speedRamp; // difficulty ramp: faster with score
      if (running) {
        stateRef.current.scroll += (effSpeed * dt);
        stateRef.current.t += dt;
      }
      // background
      ctx.clearRect(0, 0, W, H);
      // screen shake during FX
      ctx.save();
      if (fxRef.current.shake > 0) {
        const s = fxRef.current.shake;
        const mag = 6 * s; // pixels
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
        fxRef.current.shake = Math.max(0, fxRef.current.shake - dt * 1.8);
      }
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      // staff lines
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5.0;
    // Wider vertical bar lines spacing across the staff
    const barStep = 480; // pixels between bar lines
    const offset = stateRef.current.scroll % barStep;
      for (let i = 0; i < lanes; i++) {
        const y = top + i * gap;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        // bar lines scrolling left (more sparse)
        for (let x = W - offset; x > 0; x -= barStep) {
          ctx.beginPath();
          ctx.moveTo(x, y - gap / 2);
          ctx.lineTo(x, y + gap / 2);
          ctx.stroke();
        }
      }
      // character at fixed x
      const cx = Math.floor(W * 0.25);
      // 9 positions: 0..8 across lines and spaces
      const headY = top + stateRef.current.lane * halfGap; // center on position
      const cy = headY + 14; // keep body below head
      const step = Math.sin(stateRef.current.t * (running ? 7 : 0));
      const lean = running ? 0.08 : 0.02; // slight forward lean
      const armSwing = 6 * step;
      const legSpread = 10 + 4 * step;
      // stick figure
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.2;
  // head (note-sized) relative to space height
  const headR = Math.max(16, Math.min(32, Math.floor(halfGap * 1.1)));
      ctx.beginPath();
      ctx.arc(cx, headY, headR, 0, Math.PI * 2);
      ctx.fill();
      // body (slight lean)
      ctx.beginPath();
      ctx.moveTo(cx - lean * 6, cy - 6);
      ctx.lineTo(cx + lean * 6, cy + 14);
      ctx.stroke();
  // arms (swing)
  const ax1 = cx - 8, ay1 = cy - armSwing * 0.3; // left hand anchor
  const ax2 = cx + 8, ay2 = cy + armSwing * 0.3; // right hand anchor
  ctx.beginPath();
  ctx.moveTo(ax1, ay1);
  ctx.lineTo(ax2, ay2);
  ctx.stroke();
  // little hands (small segments like feet)
  ctx.beginPath();
  ctx.moveTo(ax1, ay1);
  ctx.lineTo(ax1 - 6, ay1 + 4);
  ctx.moveTo(ax2, ay2);
  ctx.lineTo(ax2 + 6, ay2 + 4);
  ctx.stroke();
      // legs (alternate)
      ctx.beginPath();
      ctx.moveTo(cx, cy + 14);
      ctx.lineTo(cx - legSpread, cy + 26);
      ctx.moveTo(cx, cy + 14);
      ctx.lineTo(cx + legSpread, cy + 26);
      ctx.stroke();
      // face (happy until game over)
      ctx.fillStyle = '#000';
      // eyes
      const eyeDX = Math.max(2, headR * 0.35);
      const eyeR = Math.max(1.5, headR * 0.12);
      const eyeY = headY - headR * 0.15;
      if (!gameOver) {
        ctx.beginPath(); ctx.arc(cx - eyeDX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + eyeDX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
        // smile
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, headY + headR * 0.18, headR * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      } else {
        // X eyes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.6;
        const xOff = eyeDX;
        const eY = eyeY;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + s * (xOff - eyeR), eY - eyeR);
          ctx.lineTo(cx + s * (xOff + eyeR), eY + eyeR);
          ctx.moveTo(cx + s * (xOff - eyeR), eY + eyeR);
          ctx.lineTo(cx + s * (xOff + eyeR), eY - eyeR);
          ctx.stroke();
        }
        // frown
        ctx.beginPath();
        ctx.arc(cx, headY + headR * 0.28, headR * 0.42, 1.15 * Math.PI, 1.85 * Math.PI, true);
        ctx.stroke();
      }

      // Spawn wave: one yellow coin (target), red monsters in all other positions (lines + spaces)
      if (running) {
        const coins = stateRef.current.coins;
        const monsters = stateRef.current.monsters;
        // dynamic spawn interval depends on difficulty
        const spawnEvery = Math.max(params.spawnMin, params.spawnBase - score * params.spawnSlope);
        stateRef.current.spawnAcc += dt;
        if (stateRef.current.spawnAcc >= spawnEvery) {
          stateRef.current.spawnAcc = 0;
          // build all possible positions: 9 (5 lines + 4 spaces)
          const positions = [];
          for (let i = 0; i < 9; i++) positions.push({ y: top + i * halfGap, idx: i });
          // choose one at random for coin (target)
          const choice = Math.floor(Math.random() * positions.length);
          const coinPos = positions[choice];
          coins.push({ x: W + 40, y: coinPos.y, r: Math.max(14, Math.floor(halfGap * 1.0)), type: 'coin', idx: coinPos.idx });
          // choose a few monsters from remaining positions, staggered in X so it's not a vertical wall
          const remaining = positions.map((p, i) => ({ ...p, i })).filter(p => p.i !== choice);
          // shuffle remaining indices
          for (let i = remaining.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
          }
          const monsterCount = Math.min(params.monsterMax, Math.max(params.monsterMin, params.monsterMin + Math.floor(score / params.monsterAddPer)));
          for (let k = 0; k < Math.min(monsterCount, remaining.length); k++) {
            const p = remaining[k];
            const xJitter = params.jitterMin + Math.random() * (params.jitterMax - params.jitterMin); // some before/after coin
            monsters.push({ x: W + 40 + xJitter, y: p.y, r: Math.max(14, Math.floor(halfGap * 1.1)), type: 'monster', idx: p.idx, seed: Math.random() * Math.PI * 2, pts: 7 + Math.floor(Math.random() * 5) });
          }
        }
        // update entities
        for (const c of coins) c.x -= effSpeed * dt;
        for (const m of monsters) m.x -= effSpeed * dt;
        // collisions: coins (collect) and monsters (game over)
        // coins: only interact on the same lane; use smaller hit radii to avoid adjacent overlaps
        for (let i = coins.length - 1; i >= 0; i--) {
          const c = coins[i];
          if ((c.idx ?? -1) !== stateRef.current.lane) continue;
          const dx = (cx) - c.x;
          const dy = headY - c.y;
          const headHitR = Math.min(headR, halfGap * params.headCoinMult);
          const coinHitR = Math.min(c.r, halfGap * params.coinMult);
          const rr = (headHitR + coinHitR) * (headHitR + coinHitR);
          if (dx * dx + dy * dy <= rr) {
            coins.splice(i, 1);
            // streak & multiplier
            const nowT = stateRef.current.t;
            if (nowT - stateRef.current.lastCollect <= 2) {
              stateRef.current.streak += 1;
            } else {
              stateRef.current.streak = 1;
            }
            stateRef.current.lastCollect = nowT;
            const mult = Math.min(4, 1 + Math.floor((stateRef.current.streak - 1) / 3));
            setScore(s => s + mult);
            try { playNoteForLane(stateRef.current.lane); } catch {}
          }
        }
        // monsters: only same lane; smaller hit radii
        for (let i = stateRef.current.monsters.length - 1; i >= 0; i--) {
          const m = stateRef.current.monsters[i];
          if ((m.idx ?? -1) !== stateRef.current.lane) continue;
          const dx = (cx) - m.x;
          const dy = headY - m.y;
          const headHitR = Math.min(headR, halfGap * params.headMonMult);
          const monHitR = Math.min(m.r, halfGap * params.monMult);
          const rr = (headHitR + monHitR) * (headHitR + monHitR);
          if (dx * dx + dy * dy <= rr) {
            setGameOver(true);
            setRunning(false);
            fxRef.current.flash = 1.0;
            fxRef.current.shake = 0.6;
            // game over cue: external url if provided, else bundled file, else jingle
            try {
              const list = Array.isArray(gameConfigRef.current.overList) ? gameConfigRef.current.overList.filter(x => x && x.enabled && x.url) : [];
              const chosenFromList = list.length > 0 ? list[Math.floor(Math.random() * list.length)]?.url : null;
              const externalOver = chosenFromList || gameConfigRef.current.overSfxUrl || overSfxUrlQP;
              if (externalOver) {
                const a = new Audio(externalOver);
                const vol = (userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0);
                a.volume = vol;
                a.play().catch(()=>{});
              } else {
                const a = new Audio('/GameSong_GameOver.wav');
                const vol = (userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0);
                a.volume = vol;
                a.play().catch(() => { try { playGameOverJingle(); } catch {} });
              }
            } catch { try { playGameOverJingle(); } catch {} }
            break;
          }
        }
  // cleanup off-screen (filter to avoid order assumptions)
  stateRef.current.coins = stateRef.current.coins.filter(c => c.x >= -60);
  stateRef.current.monsters = stateRef.current.monsters.filter(m => m.x >= -60);
      }
      // draw monsters as outlined blobs
      const drawBlob = (mx, my, r, seed, t, pts) => {
        const n = Math.max(6, Math.min(12, pts|0));
        const amp = Math.max(2, r * 0.28);
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * Math.PI * 2 + seed + t * 0.9;
          const rad = r + Math.sin(i * 1.7 + seed) * amp * 0.6 + Math.cos(i * 2.3 + seed * 1.3) * amp * 0.4;
          const x = mx + Math.cos(a) * rad;
          const y = my + Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 4.0;
      ctx.fillStyle = 'transparent';
      for (const m of stateRef.current.monsters) {
        drawBlob(m.x, m.y, m.r, m.seed || 0, stateRef.current.t, m.pts || 8);
        ctx.stroke();
        // Angry face inside blob
        const prevStroke = ctx.strokeStyle;
        const prevWidth = ctx.lineWidth;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.5, m.r * 0.12);
        const faceW = Math.max(6, m.r * 0.9);
        const eyeDX = faceW * 0.28;
        const eyeDY = faceW * -0.12;
        // eyes (angry slants)
        ctx.beginPath();
        ctx.moveTo(m.x - eyeDX - 4, m.y + eyeDY - 2);
        ctx.lineTo(m.x - eyeDX + 4, m.y + eyeDY + 2);
        ctx.moveTo(m.x + eyeDX - 4, m.y + eyeDY + 2);
        ctx.lineTo(m.x + eyeDX + 4, m.y + eyeDY - 2);
        ctx.stroke();
        // jagged mouth
        const mouthW = faceW * 0.9;
        const mouthY = m.y + faceW * 0.2;
        const teeth = 5;
        ctx.beginPath();
        for (let i = 0; i <= teeth; i++) {
          const t = i / teeth;
          const x = m.x - mouthW / 2 + t * mouthW;
          const y = mouthY + (i % 2 === 0 ? -faceW * 0.12 : faceW * 0.12);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.strokeStyle = prevStroke;
        ctx.lineWidth = prevWidth;
      }
      // draw coins (yellow)
      ctx.fillStyle = '#ffd700';
      for (const c of stateRef.current.coins) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // HUD
  ctx.fillStyle = '#9fe8c4';
  ctx.font = '18px monospace';
  ctx.fillText(`Punteggio: ${score}`, 10, 18);
      const mult = Math.min(4, 1 + Math.floor((stateRef.current.streak - 1) / 3));
      if (mult > 1) {
        ctx.fillText(`Moltiplicatore: x${mult}`, 10, 54);
      }
      const statusText = gameOver ? 'GAME OVER (R per ricominciare)' : (countdown > 0 ? `Partenza tra: ${countdown}` : (running ? 'In gioco (P per Pausa)' : 'In pausa (P per Avviare)'));
      ctx.fillText(statusText, 10, 36);

      // Countdown and GO overlay
      if (countdown > 0 || stateRef.current.goTime > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 80px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = countdown > 0 ? String(countdown) : 'VIA!';
        ctx.fillText(text, W / 2, H / 2);
        // update goTime decay
        if (stateRef.current.goTime > 0) {
          stateRef.current.goTime = Math.max(0, stateRef.current.goTime - dt);
        }
      }

      // Red flash overlay on game over
      if (fxRef.current.flash > 0) {
        ctx.fillStyle = `rgba(255,0,0,${0.5 * fxRef.current.flash})`;
        ctx.fillRect(0, 0, W, H);
        fxRef.current.flash = Math.max(0, fxRef.current.flash - dt * 1.6);
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, speed, score, playNoteForLane, playGameOverJingle, countdown, gameOver, difficulty, userSfxVol, overSfxUrlQP]);

  // Build playlist from artist tracks (if aid present and tracks include direct audio links)
  const playlistMemo = useMemo(() => playlist, [playlist]);
  // Prefer global game config and build playlist according to playlistMode
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'site', 'gameMusic'));
        if (!snap.exists() || aborted) return;
        const data = snap.data() || {};
        gameConfigRef.current = data;
        // initialize user volumes from config if not set
        if (userLoopVol === null && typeof data.loopVolume === 'number') setUserLoopVol(Math.max(0, Math.min(1, data.loopVolume)));
        if (userSfxVol === null && typeof data.sfxVolume === 'number') {
          const v = Math.max(0, Math.min(1, data.sfxVolume));
          setUserSfxVol(v);
          sfxVolRef.current = v;
        }
        // choose loop from loopList if available
        const loopItems = Array.isArray(data.loopList) ? data.loopList.filter(x => x && x.enabled && x.url) : [];
        if (loopItems.length > 0) {
          const pick = loopItems[Math.floor(Math.random() * loopItems.length)]?.url;
          if (pick) setSelectedLoopUrl(pick);
        } else if (data.loopUrl) {
          setSelectedLoopUrl(data.loopUrl);
        } else {
          setSelectedLoopUrl('');
        }

        setPreferGameConfig(true);
        // Prefer resolved playlist provided by admin
        const rp = Array.isArray(data.playlistResolved) ? data.playlistResolved.filter(t => t && t.url) : [];
        if (rp.length > 0) {
          setPlaylist(rp.map(t => ({ title: t.title || 'Traccia', url: t.url })));
        } else {
          // Fallback to manual list if provided
          const gp = Array.isArray(data.playlist) ? data.playlist.filter(t => t && t.url) : [];
          if (gp.length > 0) setPlaylist(gp.map(t => ({ title: t.title || 'Traccia', url: t.url })));
          // Otherwise artist/query fallbacks handled by later effects
        }
      } catch (e) { /* ignore */ }
    })();
    return () => { aborted = true; };
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , []);

  // Keep sfxVolRef synced when userSfxVol changes later
  useEffect(() => {
    if (userSfxVol !== null && !Number.isNaN(userSfxVol)) {
      sfxVolRef.current = Math.max(0, Math.min(1, userSfxVol));
    }
  }, [userSfxVol]);

  useEffect(() => {
    let abort = false;
    (async () => {
      if (!artistId) return;
      if (preferGameConfig) return; // don't override global config
      try {
        const snap = await getDoc(doc(db, 'artisti', artistId));
        if (!snap.exists() || abort) return;
        const data = snap.data() || {};
        const items = [];
        (data.albums || []).forEach((al) => {
          (al.tracks || []).forEach((tr) => {
            const url = tr?.link || '';
            if (typeof url === 'string' && url.match(/\.(mp3|m4a|aac|wav|ogg|oga|webm|mp4)(\?.*)?$/i)) {
              items.push({ title: tr.title || al.title || 'Traccia', url });
            }
          });
        });
        if (!abort) setPlaylist(items);
      } catch (e) {
        // ignore
      }
    })();
    return () => { abort = true; };
  }, [artistId, preferGameConfig]);

  // Fallback playlist from query params if nothing configured
  useEffect(() => {
    if (playlist.length === 0) {
      const fb = [];
      if (bg1) fb.push({ title: 'Brano 1', url: bg1 });
      if (bg2) fb.push({ title: 'Brano 2', url: bg2 });
      if (fb.length > 0) setPlaylist(fb);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const audioEl = audioPlayerRef.current;
    if (!audioEl || playlist.length === 0) return;
    audioEl.src = playlist[trackIdx % playlist.length].url;
    if (musicPlaying) {
      audioEl.play().catch(() => {});
    }
  }, [trackIdx, playlist, musicPlaying]);

  // Decouple music from game pause; manage only via explicit controls
  useEffect(() => {
    const bg = gameBgRef.current;
    const player = audioPlayerRef.current;
    if (!bg) return;
    if (playlist.length > 0 && musicPlaying && player && !player.paused) {
      bg.pause();
      bg.currentTime = 0;
    } else {
      // Try to play background loop softly
      const vol = (userLoopVol ?? gameConfigRef.current.loopVolume ?? 0.35);
      bg.volume = vol;
      // Use configured loop if available
      const externalLoop = selectedLoopUrl || gameConfigRef.current.loopUrl;
      if (externalLoop && bg.src !== externalLoop) {
        bg.src = externalLoop;
      }
      bg.play().catch(()=>{});
    }
  }, [playlist.length, musicPlaying, userLoopVol, selectedLoopUrl]);
  function toggleMusic() {
    const a = audioPlayerRef.current; if (!a) return;
    if (a.paused) {
      if (playlist.length > 0) setTrackIdx(Math.floor(Math.random() * playlist.length));
      a.play().then(() => setMusicPlaying(true)).catch(()=>{});
    }
    else { a.pause(); setMusicPlaying(false); }
  }

  function prevTrack() {
    if (playlist.length === 0) return;
    setTrackIdx((i) => (i - 1 + playlist.length) % playlist.length);
  }

  function nextTrack() {
    if (playlist.length === 0) return;
    setTrackIdx((i) => (i + 1) % playlist.length);
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
      {/* Top music player (sticky within component) */}
      <div style={{ position:'relative', zIndex: 1, display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap', background:'rgba(0,0,0,0.45)', padding:'6px 10px', borderRadius: 10, border:'1px solid rgba(255,215,0,0.3)', width:'min(96vw, 980px)', marginBottom: 8 }}>
        <strong style={{ color:'#ffd700', fontSize: 16, marginRight: 4 }}>Musica</strong>
        <button className="dash-small-btn" onClick={prevTrack} disabled={playlistMemo.length === 0} title="Precedente" style={{ padding:'6px 10px', fontSize:13 }}>◀◀</button>
        <button className="dash-small-btn" onClick={toggleMusic} disabled={playlistMemo.length === 0} style={{ padding:'6px 12px', fontSize:13 }}>
          {musicPlaying ? 'Pausa' : 'Play'}
        </button>
        <button className="dash-small-btn" onClick={nextTrack} disabled={playlistMemo.length === 0} title="Successiva" style={{ padding:'6px 10px', fontSize:13 }}>▶▶</button>
        <span style={{ color:'#9fe8c4', maxWidth: '50vw', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {playlistMemo.length > 0 ? (playlistMemo[trackIdx % playlistMemo.length]?.title || 'Traccia') : 'Nessuna traccia'}
        </span>
      </div>
      <h1 className="publicsite-title" style={{ marginBottom: 6 }}>Pentagramma Runner</h1>
      <p style={{ color: '#9fe8c4', marginTop: 0, marginBottom: 12 }}>
        Raccogli le note gialle e evita i mostri rossi: se ti prendono è GAME OVER.
        Tasti: Frecce su/giù o SPAZIO. P = Pausa. R = Restart.
      </p>
      {!running && !gameOver && (
        <button className="dash-small-btn" onClick={() => { ensureNoteAudio()?.resume?.(); countdownStart(); }} style={{ padding:'10px 18px', fontSize:16 }}>Start</button>
      )}
      {gameOver && (
        <button className="dash-small-btn" onClick={restartGame} style={{ padding:'10px 18px', fontSize:16 }}>Restart</button>
      )}
      {running && !gameOver && (
        <button className="dash-small-btn" onClick={() => setRunning(false)} style={{ marginBottom: 8, padding:'10px 18px', fontSize:16 }}>Pausa</button>
      )}
      <div style={{ width:'min(98vw, 1180px)', height: 'clamp(600px, 78vh, 1100px)', border:'1px solid rgba(255,255,255,0.25)', borderRadius: 14, overflow:'hidden', background:'rgba(0,0,0,0.85)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      </div>
      {/* Difficoltà fissa: 'facile' */}
      {/* Music + Mobile controls */}
      <div style={{ display:'flex', gap: 14, marginTop: 12, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
        <button className="dash-small-btn" onClick={() => moveLane(-1)} style={{ padding:'12px 18px', fontSize:18 }}>Su ▲</button>
        <button className="dash-small-btn" onClick={() => moveLane(1)} style={{ padding:'12px 18px', fontSize:18 }}>Giù ▼</button>
      </div>
      {/* User-facing volume controls */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:10, width:'min(96vw, 680px)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={{ color:'#ffd700', display:'flex', justifyContent:'space-between' }}>
            Volume Musica (Loop)
            <span style={{ color:'#9fe8c4', fontSize:12 }}>{Math.round(((userLoopVol ?? gameConfigRef.current.loopVolume ?? 0.35) * 100))}%</span>
          </label>
          <input type="range" min={0} max={100} value={Math.round(((userLoopVol ?? gameConfigRef.current.loopVolume ?? 0.35) * 100))}
            onChange={e => {
              const v = Math.max(0, Math.min(1, Number(e.target.value) / 100));
              setUserLoopVol(v);
              try { localStorage.setItem('game.loopVol', String(v)); } catch {}
            }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={{ color:'#ffd700', display:'flex', justifyContent:'space-between' }}>
            Volume Effetti (SFX)
            <span style={{ color:'#9fe8c4', fontSize:12 }}>{Math.round(((userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0) * 100))}%</span>
          </label>
          <input type="range" min={0} max={100} value={Math.round(((userSfxVol ?? gameConfigRef.current.sfxVolume ?? 1.0) * 100))}
            onChange={e => {
              const v = Math.max(0, Math.min(1, Number(e.target.value) / 100));
              setUserSfxVol(v);
              sfxVolRef.current = v;
              try { localStorage.setItem('game.sfxVol', String(v)); } catch {}
            }} />
        </div>
      </div>
  <audio ref={audioPlayerRef} onEnded={nextTrack} style={{ display:'none' }} />
  <audio ref={gameBgRef} src="/GameSong.mp3" loop onError={(e)=>{ const a = e.currentTarget; if (a.src.endsWith('GameSong.mp3')) { a.src = '/GameSong.wav'; try { a.play().catch(()=>{});} catch {} } }} style={{ display:'none' }} />
    </div>
  );
}
