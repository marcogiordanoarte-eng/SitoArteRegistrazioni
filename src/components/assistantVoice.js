// assistantVoice.js
// Gestione riproduzione voce "Sounds" basata sui campioni caricati (collezione voiceSamples)
// Strategia semplice di concatenazione: match phrase -> audio sample.
// Limiti: solo frasi presenti (o quasi) nei transcript salvati. Si possono ampliare i transcript aggiungendo varianti.

import { collection, getDocs } from 'firebase/firestore';

let inventoryPromise = null;
let inventory = [];// { norm, url, raw }

function normalize(text) {
  return (text||'')
    .toLowerCase()
    .replace(/[\s\n\r]+/g,' ') // spazi
    .replace(/["'“”‘’]/g,'')
    .replace(/[.,;:!?()\[\]{}]/g,'')
    .trim();
}

export function loadVoiceInventory(db) {
  if (inventoryPromise) return inventoryPromise;
  inventoryPromise = (async () => {
    try {
      const snap = await getDocs(collection(db, 'voiceSamples'));
      const list = [];
      snap.forEach(d => {
        const data = d.data() || {};
        if (!data.transcript || !data.url) return;
        const norm = normalize(data.transcript);
        if (!norm) return;
        list.push({ norm, url: data.url, raw: data.transcript });
      });
      // Ordina per lunghezza decrescente (per match più lunghi prima)
      list.sort((a,b)=> b.norm.length - a.norm.length);
      inventory = list;
      return inventory;
    } catch (e) {
      console.warn('[assistantVoice] load error', e);
      return inventory;
    }
  })();
  return inventoryPromise;
}

// Trova sequenza di clip che coprano massimamente le frasi.
export function planClips(text) {
  if (!text) return [];
  // Prima strategia (per compatibilità): per frase
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  const clips = [];
  for (const s of sentences) {
    const normSentence = normalize(s);
    if (!normSentence) continue;
    let clip = inventory.find(it => it.norm === normSentence);
    if (!clip) {
      clip = inventory.find(it => normSentence.includes(it.norm) && it.norm.length > 12) ||
             inventory.find(it => it.norm.includes(normSentence) && normSentence.length > 8);
    }
    if (clip) clips.push(clip.url);
  }
  const seen = new Set();
  const ordered = [];
  for (const u of clips) { if (!seen.has(u)) { seen.add(u); ordered.push(u); } }
  // Se abbiamo ottenuto una sola clip ma il testo è molto lungo, proviamo algoritmo avanzato multi-match
  if (ordered.length <= 1 && text.length > 80) {
    const normFull = normalize(text);
    const candidates = [];// { idx, len, url }
    inventory.forEach(it => {
      if (it.norm.length < 10) return;
      const pos = normFull.indexOf(it.norm);
      if (pos !== -1) candidates.push({ idx: pos, len: it.norm.length, url: it.url, norm: it.norm });
    });
    // Ordina per posizione poi lunghezza decrescente (per scegliere segmenti lunghi mantenendo ordine)
    candidates.sort((a,b)=> a.idx === b.idx ? b.len - a.len : a.idx - b.idx);
    const taken = [];// intervalli { start, end }
    const advanced = [];
    for (const c of candidates) {
      const start = c.idx, end = c.idx + c.len;
      const overlaps = taken.some(t => !(end <= t.start || start >= t.end));
      if (overlaps) continue;
      taken.push({ start, end });
      advanced.push(c.url);
    }
    // ordine già per idx, dedup
    const seq = [];
    const seen2 = new Set();
    for (const u of advanced) { if (!seen2.has(u)) { seen2.add(u); seq.push(u); } }
    if (seq.length > ordered.length) return seq;
  }
  return ordered;
}

let currentChain = null; // { abort, urls, index, audio, completed }
let lastInterruptedUrls = null; // salvate quando interrompiamo una catena in corso

function stopCurrentAudio(fadeMs = 120) {
  if (!currentChain || !currentChain.audio) return;
  const a = currentChain.audio;
  try {
    if (fadeMs > 0 && !a.paused) {
      const startVol = a.volume;
      const steps = 6;
      let n = 0;
      const dec = setInterval(()=>{
        n++; try { a.volume = Math.max(0, startVol * (1 - n/steps)); } catch {}
        if (n>=steps) { clearInterval(dec); try { a.pause(); a.src=''; } catch {} }
      }, Math.max(10, fadeMs/steps));
    } else {
      a.pause(); a.src='';
    }
  } catch {}
}

export function playClips(urls, { onStart, onEnd, onClip, resumePreviousAfter = false } = {}) {
  if (!urls || !urls.length) return { cancel: () => {} };
  // Se c'è una catena attiva non ancora completata, salva il resto per possibile ripresa
  if (currentChain && !currentChain.completed && !currentChain.abort) {
    if (resumePreviousAfter) {
      try {
        const remainingIdx = Math.max(0, (currentChain.index||0) - 1);
        const remaining = currentChain.urls.slice(remainingIdx);
        if (remaining.length) lastInterruptedUrls = remaining;
      } catch {}
    } else {
      // Non vogliamo ripresa: scarta qualsiasi precedente coda interrotta
      lastInterruptedUrls = null;
    }
    // ferma audio corrente
    stopCurrentAudio();
    currentChain.abort = true;
  }
  const chain = { abort:false, urls:[...urls], index:0, audio:null, completed:false };
  currentChain = chain;
  if (!resumePreviousAfter) {
    // Se non si deve riprendere, assicurati di eliminare eventuale traccia residua
    lastInterruptedUrls = null;
  }
  if (onStart) onStart();
  function next() {
    if (chain.abort) { chain.completed = true; if (onEnd) onEnd(); return; }
    if (chain.index >= chain.urls.length) {
      chain.completed = true;
      if (onEnd) onEnd();
      // Se richiesto riprendi precedente
      if (resumePreviousAfter && lastInterruptedUrls && lastInterruptedUrls.length) {
        const prev = lastInterruptedUrls; lastInterruptedUrls = null;
        playClips(prev, {}); // riparte senza cascata ulteriore
      }
      return;
    }
    const url = chain.urls[chain.index++];
    const audio = new Audio(url);
    chain.audio = audio;
    audio.preload = 'auto';
    audio.onended = () => { if (onClip) onClip(url); next(); };
    audio.onerror = () => { next(); };
    audio.play().catch(()=>{ next(); });
  }
  next();
  return { cancel: () => { if (!chain.abort) { chain.abort = true; stopCurrentAudio(); } } };
}

export function resumeLastInterrupted() {
  if (lastInterruptedUrls && lastInterruptedUrls.length) {
    const urls = lastInterruptedUrls; lastInterruptedUrls = null;
    return playClips(urls, {});
  }
  return { cancel:()=>{} };
}

export function stopVoicePlayback() {
  if (currentChain && !currentChain.abort) {
    currentChain.abort = true;
    stopCurrentAudio();
  }
}
