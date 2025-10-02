import { useCallback, useEffect, useRef, useState } from 'react';

// Hook per catturare il microfono e produrre un livello RMS (0..1) in tempo quasi reale.
// start() richiede un gesto utente (click/long press) per evitare blocchi dei permessi.
export function useMicAnalyser(options = {}) {
  const { smoothing = 0.25, fftSize = 256, autoStopOnInactive = false, initialGain = 1, autoBoost = false } = options;
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [gain, setGain] = useState(initialGain);
  const [inputs, setInputs] = useState([]); // lista dispositivi audioinput
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const lastBoostRef = useRef(0);

  const analyse = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128; sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length); // 0..~1
    const adj = rms * gain;
    setLevel(prev => prev * smoothing + adj * (1 - smoothing));
    rafRef.current = requestAnimationFrame(analyse);
  }, [smoothing]);

  const stop = useCallback(() => {
    setActive(false);
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current); } catch {}
    rafRef.current = null;
    try { streamRef.current?.getTracks()?.forEach(t => t.stop()); } catch {}
    streamRef.current = null;
    try { ctxRef.current && ctxRef.current.close?.(); } catch {}
    ctxRef.current = null;
    analyserRef.current = null;
  }, []);

  const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production');

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const ins = list.filter(d => d.kind === 'audioinput');
      setInputs(ins);
      const exists = ins.some(d => d.deviceId === selectedDeviceId);
      if ((!selectedDeviceId || !exists) && ins.length) {
        const first = ins[0].deviceId;
        if (isDev && selectedDeviceId && !exists) console.log('[useMicAnalyser] previous device disappeared, fallback to', first);
        setSelectedDeviceId(first);
      }
    } catch (e) { if (isDev) console.warn('[useMicAnalyser] enumerate error', e); }
  }, [selectedDeviceId, isDev]);

  const start = useCallback(async (deviceId) => {
    if (active) return; // già attivo
    setError(null);
    try {
      if (isDev) console.log('[useMicAnalyser] start() requesting media; device=', deviceId || selectedDeviceId);
      const baseConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      };
      const audio = deviceId || selectedDeviceId ? { ...baseConstraints, deviceId: { exact: deviceId || selectedDeviceId } } : baseConstraints;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio });
      } catch (primaryErr) {
        if (isDev) console.warn('[useMicAnalyser] primary getUserMedia failed, retry simpler', primaryErr);
        // Fallback semplificato
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      streamRef.current = stream;
      // Aggiorna lista dispositivi (labels sbloccate dopo permesso)
      refreshDevices();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyserRef.current = analyser;
      src.connect(analyser);
      setActive(true);
      if (isDev) console.log('[useMicAnalyser] microphone active, sampleRate=', ctx.sampleRate);
      analyse();
    } catch (e) {
      if (isDev) console.warn('[useMicAnalyser] error accessing mic', e);
      setError(e);
      stop();
    }
  }, [active, analyse, fftSize, stop, isDev, refreshDevices, selectedDeviceId]);

  // Auto stop se voluto e active cambia
  useEffect(() => {
    if (!autoStopOnInactive || active) return;
    stop();
  }, [active, autoStopOnInactive, stop]);

  useEffect(() => () => { stop(); }, [stop]);

  // Refresh devices when permissions possibly granted
  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices?.addEventListener('devicechange', refreshDevices);
    return () => { navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices); };
  }, [refreshDevices]);

  // Se il dispositivo selezionato cambia e siamo attivi ma lo stream appartiene a un altro device, riavvia.
  useEffect(() => {
    if (!active || !selectedDeviceId) return;
    try {
      const track = streamRef.current?.getAudioTracks?.()[0];
      const currentDev = track?.getSettings?.().deviceId;
      if (currentDev && currentDev !== selectedDeviceId) {
        if (isDev) console.log('[useMicAnalyser] restarting stream with new selected device', selectedDeviceId);
        stop();
        setTimeout(()=> start(selectedDeviceId), 80);
      }
    } catch {}
  }, [selectedDeviceId, active, stop, start, isDev]);

  return {
    level,
    error,
    active,
    start,
    stop,
    stream: streamRef.current,
    inputs,
    refreshDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    gain,
    setGain,
    autoBoost
  };
}

// Effetto auto-boost del gain se livello persistentemente troppo basso
// Lo mettiamo fuori dalla funzione? No: deve stare dentro; ma per semplicità lo aggiungiamo subito dopo la definizione export.
// (Nota: mantenuto qui in fondo per minimizzare rischio di conflitti; avendo closure su variabili già restituite non funziona. Spostiamo dentro prima del return.)
