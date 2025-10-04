import React, { useState, useRef, useEffect } from 'react';

/**
 * VoiceAssistantLite (Phase B) - Interfaccia minimale solo audio
 * Funzioni:
 *  - Input testo -> /ask_and_speak (riceve WAV e riproduce)
 *  - Pulsante "Parla" -> /parla (frase fissa)
 *  - Stato caricamento / errore
 *  - Ultima risposta testuale mostrata (intestazione)
 *  - Nessuna chat persistente, nessuna UI complessa
 */
export default function VoiceAssistantLite({ endpointBase }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [serverOk, setServerOk] = useState(null); // null=unknown, true/false
  const [latencyMs, setLatencyMs] = useState(null);
  const [lastTried, setLastTried] = useState([]);
  const [debugInfo, setDebugInfo] = useState('');
  const [welcomePlayed, setWelcomePlayed] = useState(false);
  const [activeBase, setActiveBase] = useState(null); // endpoint selezionato dinamicamente
  const audioRef = useRef(null);

  // Determinazione endpoint dinamica
  const resolvedEndpoint = (() => {
    if (activeBase) return activeBase;
    if (endpointBase) return endpointBase.replace(/\/$/, '');
    if (typeof window !== 'undefined') {
      if (window.__VOICE_ENDPOINT) return String(window.__VOICE_ENDPOINT).replace(/\/$/, '');
      if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_VOICE_ENDPOINT) {
        return process.env.REACT_APP_VOICE_ENDPOINT.replace(/\/$/, '');
      }
    }
    return 'http://127.0.0.1:5005';
  })();

  // Multi-probing: tenta più endpoint se il principale fallisce alla prima esecuzione
  async function probeEndpoints() {
    const tried = [];
    let cancelled = false; // scoped flag (unchanged)
    const baseGuess = activeBase || resolvedEndpoint;
    const bases = new Set();
    bases.add(baseGuess);
    const hostVariants = [
      'http://127.0.0.1:5005','http://localhost:5005',
      'http://127.0.0.1:8000','http://localhost:8000'
    ];
    hostVariants.forEach(v=>bases.add(v));
    if (typeof window !== 'undefined' && window.location) bases.add(window.location.origin.replace(/\/$/, ''));
    const candidates = Array.from(bases);
    let success = false; let firstError = null;
    for (const base of candidates) {
      const url = base + '/ping';
      tried.push(url);
      const t0 = performance.now();
      try {
        const r = await fetch(url, { method:'GET' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const headerFlag = r.headers.get('X-Voice-Server');
        let data = {};
        try { data = await r.json(); } catch {}
        const looksValid = headerFlag === '1' || (data && data.device && data.status === 'ok');
        if (!looksValid) throw new Error('Non è il voice server');
        setLatencyMs(Math.round(performance.now()-t0));
        setServerOk(true);
        setActiveBase(base);
        success = true;
        break;
      } catch (e) { if (!firstError) firstError = e; }
    }
    if (!success) {
      setServerOk(false);
      setError(`Voice server non trovato. Tentati: ${tried.join(', ')}. Primo errore: ${(firstError && firstError.message) || 'sconosciuto'}`);
    }
    setLastTried(tried);
  }

  useEffect(() => {
    let cancelled = false;
    probeEndpoints();
    return () => { cancelled = true; };
  }, [resolvedEndpoint]);

  async function fetchAudio(path, body) {
    setLoading(true); setError('');
    try {
  const resp = await fetch(`${resolvedEndpoint}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'audio/wav,application/json' },
        body: JSON.stringify(body || {})
      });
      if (!resp.ok) {
        if (resp.status === 207) {
          const data = await resp.json();
            setLastReply(data.reply || '(nessuna risposta)');
            setError('Sintesi non disponibile (parziale)');
            return true;
        }
        throw new Error(`HTTP ${resp.status}`);
      }
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('audio')) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.play().catch(()=>{});
        }
        const replyHeader = resp.headers.get('X-Reply');
        if (replyHeader) setLastReply(replyHeader);
        return true;
      }
      if (ct.includes('application/json')) {
        const data = await resp.json();
        if (data.reply) setLastReply(data.reply);
        else setLastReply('(risposta json)');
        return true;
      }
      setError('Formato risposta inatteso');
      return false;
    } catch (e) {
      setError(`Fetch fallita: ${e.message}. Possibili cause: server spento, porta errata, CORS, mixed-content (https→http).`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  // Fallback GET audio function (e.g. /ask_and_speak_get?prompt=...)
  async function fetchAudioGET(fullPath) {
    setLoading(true); setError('');
    try {
      const resp = await fetch(`${resolvedEndpoint}${fullPath}`, { method:'GET', headers:{ 'Accept':'audio/wav,application/json' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('audio')) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          await audioRef.current.play().catch(()=>{});
        }
        const replyHeader = resp.headers.get('X-Reply');
        if (replyHeader) setLastReply(replyHeader);
        return true;
      }
      if (ct.includes('application/json')) {
        const data = await resp.json();
        if (data.reply) setLastReply(data.reply);
        return true;
      }
      setError('Formato risposta inatteso (GET)');
      return false;
    } catch(e) {
      setError(prev => prev ? prev + ` | GET fallita: ${e.message}` : `GET fallita: ${e.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleAskSpeak() {
    const clean = text.trim();
    if (!clean) return;
    setLastReply('');
    let stepInfo = [];

    // Step 1: POST /ask_and_speak
    stepInfo.push('POST /ask_and_speak');
    let ok = await fetchAudio('/ask_and_speak', { text: clean });
    if (ok) { setDebugInfo(stepInfo.join(' -> ')); return; }

    // Step 2: GET /ask_and_speak_get
    stepInfo.push('GET /ask_and_speak_get');
    ok = await fetchAudioGET(`/ask_and_speak_get?prompt=${encodeURIComponent(clean)}`);
    if (ok) { setDebugInfo(stepInfo.join(' -> ')); return; }

    // Step 3: GET /ask_text (solo testo)
    stepInfo.push('GET /ask_text');
    try {
      setLoading(true); setError(prev=>prev||'');
      const r = await fetch(`${resolvedEndpoint}/ask_text?prompt=${encodeURIComponent(clean)}`);
      if (r.ok) {
        const data = await r.json().catch(()=>({}));
        if (data.reply) setLastReply(data.reply);
        // Sintesi lato client (Web Speech)
        if (data.reply && 'speechSynthesis' in window) {
          try { const ut = new SpeechSynthesisUtterance(data.reply); ut.lang = 'it-IT'; window.speechSynthesis.speak(ut); } catch {}
        }
        setDebugInfo(stepInfo.join(' -> '));
        return;
      }
    } catch(e) {
      setError(prev => prev ? prev + ' | /ask_text err: ' + e.message : '/ask_text err: ' + e.message);
    } finally { setLoading(false); }

    // Step 4: POST /ask (ultima risorsa)
    stepInfo.push('POST /ask (fallback finale)');
    try {
      setLoading(true);
      const r = await fetch(`${resolvedEndpoint}/ask`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: clean }) });
      if (r.ok) {
        const data = await r.json();
        setLastReply(data.reply || '(nessuna risposta)');
        if (data.reply && 'speechSynthesis' in window) {
          try { const ut = new SpeechSynthesisUtterance(data.reply); ut.lang='it-IT'; window.speechSynthesis.speak(ut); } catch {}
        }
      } else {
        setError(prev => prev ? prev + ` | POST /ask HTTP ${r.status}` : `POST /ask HTTP ${r.status}`);
      }
    } catch(e) {
      setError(prev => prev ? prev + ' | POST /ask err: ' + e.message : 'POST /ask err: ' + e.message);
    } finally {
      setLoading(false);
      setDebugInfo(stepInfo.join(' -> '));
    }
  }

  async function handleAskOnly() {
    const clean = text.trim(); if (!clean) return;
    setLoading(true); setError(''); setLastReply('');
    try {
      const r = await fetch(`${resolvedEndpoint}/ask`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: clean }) });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const data = await r.json();
      setLastReply(data.reply || '(nessuna risposta)');
    } catch (e) {
      setError('Test /ask fallito: '+e.message);
    } finally { setLoading(false); }
  }

  async function handleEcho() {
    setLoading(true); setError(''); setDebugInfo('');
    try {
      const r = await fetch(`${resolvedEndpoint}/echo`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ping:'pong', ts: Date.now() }) });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const data = await r.json();
      setDebugInfo(JSON.stringify(data));
    } catch(e) {
      setError('Echo fallito: '+e.message);
    } finally { setLoading(false); }
  }

  async function handleParla() {
    setLastReply('');
    setLoading(true); setError('');
    try {
  const resp = await fetch(`${resolvedEndpoint}/parla`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = url; audioRef.current.play().catch(()=>{}); }
      setLastReply('Frase di benvenuto.');
    } catch (e) { setError(e.message || 'Errore'); }
    finally { setLoading(false); }
  }

  // Auto benvenuto: dopo primo serverOk true, se non già riprodotto
  useEffect(() => {
    if (serverOk && !welcomePlayed) {
      (async () => {
        try {
          const r = await fetch(`${resolvedEndpoint}/parla_welcome`);
          if (r.ok) {
            const ct = r.headers.get('content-type')||'';
            if (ct.includes('audio')) {
              const blob = await r.blob();
              const url = URL.createObjectURL(blob);
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = url;
                audioRef.current.play().catch(()=>{});
              }
              const rep = r.headers.get('X-Reply');
              if (rep) setLastReply(rep); else setLastReply(prev=> prev || 'Benvenuto!');
            }
          }
        } catch(e) {
          // Silenzioso: non bloccare UI
        } finally {
          setWelcomePlayed(true);
        }
      })();
    }
  }, [serverOk, welcomePlayed, resolvedEndpoint]);

  return (
    <div style={{ position:'fixed', bottom:16, left:16, zIndex:15000, background:'rgba(0,25,40,0.85)', border:'1px solid #0ab2e8', padding:12, borderRadius:14, width:300, fontSize:'.72rem', color:'#d8f9ff', boxShadow:'0 0 12px rgba(0,180,255,0.4)', backdropFilter:'blur(4px)' }}>
      <strong style={{ fontSize:'.75rem', letterSpacing:'.5px' }}>Assistente Vocale</strong>
      <div style={{ marginTop:4, fontSize:'.55rem', opacity:.8 }}>
  Endpoint: {resolvedEndpoint} <br/>Stato: {serverOk === null ? '...' : serverOk ? 'Online' : 'Offline'} {latencyMs!=null && serverOk && `(${latencyMs}ms)`}
      </div>
      {lastReply && <div style={{ marginTop:6, padding:6, background:'rgba(255,255,255,0.06)', borderRadius:8, maxHeight:110, overflowY:'auto' }}>{lastReply}</div>}
      <div style={{ marginTop:6, display:'flex', gap:6 }}>
        <button onClick={probeEndpoints} style={{ ...btnStyle, flex:1 }}>Riprova Connessione</button>
        <button onClick={()=>{ if (typeof window!=='undefined'){ const val = prompt('Nuovo endpoint', resolvedEndpoint) || resolvedEndpoint; window.__VOICE_ENDPOINT = val; setActiveBase(val.replace(/\/$/, '')); probeEndpoints(); } }} style={{ ...btnStyle, flex:1, background:'linear-gradient(135deg,#5a0482,#9620c6)' }}>Cambia Endpoint</button>
      </div>
      {lastTried.length > 0 && (
        <div style={{ marginTop:6, fontSize:'.47rem', lineHeight:1.2, opacity:.6 }}>Tentativi: {lastTried.join(' | ')}</div>
      )}
      <div style={{ display:'flex', gap:6, marginTop:8 }}>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Fai una domanda..."
          style={{ flex:1, background:'#072633', color:'#bfefff', border:'1px solid #0a6c8f', borderRadius:8, padding:'6px 8px', fontSize:'.7rem' }}
          disabled={loading}
        />
      </div>
      <div style={{ display:'flex', gap:8, marginTop:8 }}>
        <button onClick={handleAskSpeak} disabled={loading || !text.trim()} style={btnStyle}>Chiedi & Parla</button>
        <button onClick={handleParla} disabled={loading} style={btnStyle}>Parla</button>
      </div>
      <div style={{ display:'flex', gap:8, marginTop:6 }}>
        <button onClick={handleAskOnly} disabled={loading || !text.trim()} style={{ ...btnStyle, background:'linear-gradient(135deg,#0d7d3b,#15b45b)' }}>Solo Testo</button>
        <button onClick={handleEcho} disabled={loading} style={{ ...btnStyle, background:'linear-gradient(135deg,#5f088c,#8e30c9)' }}>Echo</button>
      </div>
      {loading && <div style={{ marginTop:6, color:'#7fdfff' }}>Elaboro...</div>}
      {error && <div style={{ marginTop:6, color:'#ffa5a5', whiteSpace:'pre-wrap' }}>{error}</div>}
  {debugInfo && <div style={{ marginTop:6, fontSize:'.55rem', lineHeight:1.2, background:'rgba(255,255,255,0.07)', padding:6, borderRadius:8 }}>{debugInfo}</div>}
      <audio ref={audioRef} style={{ marginTop:8, width:'100%' }} controls />
    </div>
  );
}

const btnStyle = { background:'linear-gradient(135deg,#0582ad,#00b7ff)', border:'1px solid #26d1ff', color:'#fff', padding:'6px 8px', fontSize:'.65rem', borderRadius:8, cursor:'pointer', flex:1 };
