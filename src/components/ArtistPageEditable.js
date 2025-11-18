import React, { useState, useRef, useEffect } from "react";
import BulkTrackUploader from './BulkTrackUploader';
import "./Artisti.css";
// Reintroduciamo solo l'upload verso Firebase Storage al momento del salvataggio
import { storage, functions, auth, STORAGE_BUCKET, fetchArtistData, fetchAppleArtistData, db } from "./firebase";
import { doc as fsDoc, setDoc as fsSetDoc, serverTimestamp as fsServerTimestamp } from 'firebase/firestore';
import { httpsCallable } from "firebase/functions";
import Icon from "./Icon";
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL } from "firebase/storage";

// Helpers di modulo (no React state qui)
function slugify(str, fallback = 'item') {
  const s = (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '').slice(0, 60);
  return s || fallback;
}

function guessAudioExt(file) {
  const name = ((file && file.name) || '').toLowerCase();
  if (name.endsWith('.mp3')) return 'mp3';
  if (name.endsWith('.m4a')) return 'm4a';
  if (name.endsWith('.aac')) return 'aac';
  if (name.endsWith('.wav')) return 'wav';
  if (name.endsWith('.ogg') || name.endsWith('.oga')) return 'ogg';
  const t = ((file && file.type) || '').toLowerCase();
  if (t.includes('mpeg')) return 'mp3';
  if (t.includes('aac')) return 'aac';
  if (t.includes('mp4')) return 'm4a';
  if (t.includes('wav')) return 'wav';
  if (t.includes('ogg')) return 'ogg';
  return 'mp3';
}

function ArtistPageEditable({ artist = {}, onSave, onCancel, hideSteps = false, hideStripePaymentLink = false, restrictToBioAndPhoto = false, simpleMode = true }) {
  const useSignedPost = (process.env.REACT_APP_USE_SIGNED_POST || 'false') === 'true';
  // Default a true per bypassare preflight problematici; si può disattivare mettendo REACT_APP_UPLOAD_SIMPLE=false
  const forceSimpleUpload = (process.env.REACT_APP_UPLOAD_SIMPLE || 'true') === 'true';
  // Disabilita di default l'upload via fetch/resumable per tornare al percorso legacy che funzionava
  const forceFetchUpload = (process.env.REACT_APP_FORCE_FETCH_UPLOAD || 'false') === 'true';
  // Default buttons and empty album template
  const defaultButtons = [
    { name: "Spotify", icon: null, link: "" },
    { name: "YouTube", icon: null, link: "" },
    { name: "Apple Music", icon: null, link: "" },
    { name: "Play", icon: null, link: "" },
    { name: "Buy & Download", icon: null, link: "" }
  ];
  
  
  const emptyAlbum = {
    title: "",
    year: "",
    genre: "",
    cover: null,
    // NEW METADATA FIELDS (uniform with single-track manager)
    upc: "",
    releaseId: "",
    publicationType: "",
    publicationDate: "", // ISO yyyy-mm-dd
    composerName: "",
    composerIpi: "",
    siaePosition: "",
    drmCode: "",
    isrc: "", // optional future use
    // AUDIO ASSETS
    streamAudioUrl: "", // full MP3/AAC streaming for store
    fullAudioUrl: "", // full quality (e.g. WAV) master link (kept separate from downloadLink)
    downloadLink: "", // kept for backward compatibility (will mirror fullAudioUrl)
    paymentLinkUrl: "",
    // STREAMING BUTTONS + TRACK LIST
    buttons: defaultButtons.map(b => ({ ...b })),
    tracks: [],
    // IMPORT SUPPORT FIELDS (Spotify / Apple / YouTube)
    spotifyTrackUrl: "",
    spotifyImported: false,
    spotifyTrackPreview: "",
    spotifyTrackTitle: "",
    appleTrackUrl: "",
    appleImported: false,
    appleTrackPreview: "",
    appleTrackTitle: "",
    youtubeTrackUrl: "",
    videoUrl: ""
  };
  // State for album form editing and uploads
  const [editingIdx, setEditingIdx] = useState(null);
  const [albumForm, setAlbumForm] = useState(emptyAlbum);
  // Stato autogenerazione codici
  const [autoGen, setAutoGen] = useState({ enabled: false, country: 'IT', label: 'ABC', year2d: String(new Date().getFullYear()).slice(-2), startSeq: 1 });
  const [zipUploading, setZipUploading] = useState(false);
  const [zipUploadPct, setZipUploadPct] = useState(0);
  
  // Handler drag & drop immagini gallery (steps)
  function handleStepImageDrop(idx) {
    return function (e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          const base64 = event.target.result;
          setSteps(arr => arr.map((img, i) => i === idx ? base64 : img));
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // Handler drag & drop foto artista
  function handleImageDrop(setter) {
    return function (e) {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
          setter(event.target.result);
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // Handler drag & drop cover album
  function handleAlbumCoverDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        setAlbumForm({ ...albumForm, cover: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  }

  // Handler per modifica campo album
  function handleAlbumField(field, value) {
    setAlbumForm({ ...albumForm, [field]: value });
  }

  // Handler per modifica link pulsante album
  function handleAlbumButtonLink(idx, value) {
    setAlbumForm({
      ...albumForm,
      buttons: albumForm.buttons.map((b, i) => i === idx ? { ...b, link: value } : b)
    });
  }

  // Handler per salvataggio album
  function handleSaveAlbum() {
    const toSave = normalizeStreamingButtons(albumForm);
    // Autogenerazione codici se richiesto e mancanti
    if (autoGen.enabled) {
      const { country, label, year2d, startSeq } = autoGen;
      // UPC generato se vuoto: struttura semplice COUNTRY+LABEL+YEAR+random/seq
      if (!toSave.upc) {
        const base = `${country}${label}${year2d}`.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
        const rand = String(Math.floor(Math.random()*100000)).padStart(5,'0');
        toSave.upc = (base + rand).slice(0,20);
      }
      // ISRC: IT-XXX-YY-NNNNN per l'album (se singolo) oppure assegnato alle tracce durante salvataggio globale
      if (!toSave.isrc) {
        const seq = String(startSeq).padStart(5,'0');
        toSave.isrc = `${country}-${label}-${year2d}-${seq}`.toUpperCase().replace(/[^A-Z0-9-]/g,'');
      }
    }
    if (editingIdx !== null) {
      setAlbums(albums.map((a, i) => i === editingIdx ? toSave : a));
    } else {
      setAlbums([...albums, toSave]);
    }
    setAlbumForm(emptyAlbum);
    setEditingIdx(null);
  }

  // Helper per aggiornare/creare un pulsante specifico e impostarne il link
  function setButtonLink(prevAlbum, buttonName, linkValue) {
    const buttons = Array.isArray(prevAlbum.buttons) ? [...prevAlbum.buttons] : defaultButtons.map(b => ({ ...b }));
    const idx = buttons.findIndex(b => (b.name || '').toLowerCase() === buttonName.toLowerCase());
    if (idx >= 0) {
      if (!buttons[idx].link && linkValue) buttons[idx] = { ...buttons[idx], link: linkValue };
    } else {
      if (linkValue) buttons.push({ name: buttonName, icon: null, link: linkValue });
      else buttons.push({ name: buttonName, icon: null, link: '' });
    }
    return { ...prevAlbum, buttons };
  }

  // Handler per modifica album
  function handleEditAlbum(idx) {
    setEditingIdx(idx);
    const alb = albums[idx] || {};
    // Prefill riquadri URL streaming dai pulsanti esistenti
    const btn = (alb.buttons || []).reduce((acc, b) => {
      const n = (b.name || '').toLowerCase();
      if (n === 'spotify' && b.link) acc.sp = b.link;
      if ((n.includes('apple') || n === 'apple music') && b.link) acc.ap = b.link;
      if (n === 'youtube' && b.link) acc.yt = b.link;
      return acc;
    }, { sp: '', ap: '', yt: '' });
    const derivedYT = btn.yt || (alb.videoUrl && /(youtube\.com|youtu\.be)\//i.test(alb.videoUrl) ? alb.videoUrl : '');
    setAlbumForm({
      ...alb,
      spotifyTrackUrl: (alb.spotifyTrackUrl || btn.sp || ''),
      appleTrackUrl: (alb.appleTrackUrl || btn.ap || ''),
      youtubeTrackUrl: (alb.youtubeTrackUrl || derivedYT || ''),
      upc: alb.upc || "",
      releaseId: alb.releaseId || "",
      publicationType: alb.publicationType || "",
      publicationDate: alb.publicationDate || "",
      composerName: alb.composerName || "",
      composerIpi: alb.composerIpi || "",
      siaePosition: alb.siaePosition || "",
      drmCode: alb.drmCode || "",
      isrc: alb.isrc || "",
      streamAudioUrl: alb.streamAudioUrl || alb.previewAudioUrl || "",
      fullAudioUrl: alb.fullAudioUrl || alb.downloadLink || "",
    });
  }

  // Handler per rimozione album
  function handleRemoveAlbum(idx) {
    setAlbums(albums.filter((_, i) => i !== idx));
    setEditingIdx(null);
    setAlbumForm(emptyAlbum);
  }

  // Fallback: selettori file oltre al drag&drop
  function openFilePicker(accept, onFile) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => onFile(e.target.result);
      reader.readAsDataURL(file);
    };
    input.click();
  }
  const selectStep = (idx) => openFilePicker('image/*', (base64) => setSteps(arr => arr.map((img, i) => i === idx ? base64 : img)));
  const selectPhoto = () => openFilePicker('image/*', (base64) => setPhoto(base64));
  const selectAlbumCover = () => openFilePicker('image/*', (base64) => setAlbumForm({ ...albumForm, cover: base64 }));
  const selectAlbumVideo = () => openFilePicker('video/mp4,video/webm,video/quicktime', (base64) => setAlbumForm({ ...albumForm, videoUrl: base64 }));
  // ZIP upload removed: use WAV master upload instead

  // slugify helper moved to module scope

  // NEW: Upload Preview (MP3/AAC) and Master WAV (replaces ZIP logic)
  async function uploadAlbumStreaming(file) {
    try {
  const MAX_STREAM = 200 * 1024 * 1024; // fino a ~200MB per streaming completo (consentito anche WAV). Attenzione a banda/costi.
      if (file.size > MAX_STREAM) {
        alert(`File troppo grande: ${(file.size/1024/1024).toFixed(1)}MB (max ${(MAX_STREAM/1024/1024)}MB per streaming)`);
        return;
      }
      setAudioUploadingIdx('stream');
      setAudioUploadPct(0);
      const artistSlug = slugify(name);
      const albumSlug = slugify(albumForm.title || 'singolo');
      const ext = guessAudioExt(file);
      const storagePath = `album-stream/${artistSlug}/${albumSlug}_${Date.now()}.${ext}`;
      const storageRef = ref(storage, storagePath);
      await uploadWithFallback(storageRef, storagePath, file, { contentType: file.type || `audio/${ext}` }, (pct) => setAudioUploadPct(pct));
      const url = await getDownloadURL(storageRef);
      setAlbumForm(prev => ({ ...prev, streamAudioUrl: url }));
      // Auto-add to tracks list if not present
      setAlbumForm(prev => {
        const exists = (prev.tracks||[]).some(t => t.link === url);
        return exists ? prev : { ...prev, tracks: [...(prev.tracks||[]), { title: prev.title || 'Streaming', link: url }] };
      });
    } catch (e) {
      console.error('Errore upload streaming', e);
      alert('Errore upload streaming: ' + (e?.message || e));
    } finally {
      setAudioUploadingIdx(null);
      setAudioUploadPct(0);
    }
  }

  async function uploadAlbumWavMaster(file) {
    try {
      const MAX_WAV = 220 * 1024 * 1024; // 220MB
      if (file.size > MAX_WAV) {
        alert(`WAV troppo grande: ${(file.size/1024/1024).toFixed(1)}MB (max ${(MAX_WAV/1024/1024)}MB)`);
        return;
      }
      if (!/\.wav$/i.test(file.name) && !/audio\/wav|audio\/(x-)?wave/i.test(file.type)) {
        const proceed = window.confirm('Il file non sembra WAV. Procedere comunque?');
        if (!proceed) return;
      }
      setZipUploading(true); // reuse ZIP progress UI for master WAV
      setZipUploadPct(0);
      const artistSlug = slugify(name);
      const albumSlug = slugify(albumForm.title || 'album');
      const storagePath = `album-masters/${artistSlug}/${albumSlug}_${Date.now()}.wav`;
      const storageRef = ref(storage, storagePath);
      await uploadWithFallback(storageRef, storagePath, file, { contentType: file.type || 'audio/wav' }, (pct) => setZipUploadPct(pct));
      const url = await getDownloadURL(storageRef);
      setAlbumForm(prev => ({ ...prev, fullAudioUrl: url, downloadLink: url }));
    } catch (e) {
      console.error('Errore upload WAV master', e);
      alert('Errore upload WAV: ' + (e?.message || e));
    } finally {
      setZipUploading(false);
      setZipUploadPct(0);
    }
  }

  // Stato upload audio singolo (Play)
  const [audioUploadingIdx, setAudioUploadingIdx] = useState(null);
  const [audioUploadPct, setAudioUploadPct] = useState(0);
  const [tracksUploading, setTracksUploading] = useState(false);
  const [tracksProgress, setTracksProgress] = useState({ done: 0, total: 0, last: 0 });
  // Probe stato URL streaming per evitare link rotti (404)
  const [streamProbe, setStreamProbe] = useState({ status: 'idle', code: 0 }); // idle | ok | nf | err
  useEffect(() => {
    let aborted = false;
    async function probe(url){
      if (!url) { setStreamProbe({ status:'idle', code:0 }); return; }
      try {
        setStreamProbe({ status:'idle', code:0 });
        const ctrl = new AbortController();
        const t = setTimeout(()=>ctrl.abort(), 2500);
        // Preferisci HEAD; alcuni bucket possono bloccare -> consenti ok su 200/206/204
        const r = await fetch(url, { method:'HEAD', mode:'no-cors', signal: ctrl.signal }).catch(()=>null);
        clearTimeout(t);
        if (aborted) return;
        if (r && (r.ok || [200,204,206].includes(r.status))) {
          setStreamProbe({ status:'ok', code:r.status||200 });
          return;
        }
        // Best-effort: prova GET con Range 0-0 se CORS permette
        try {
          const c2 = new AbortController();
          const t2 = setTimeout(()=>c2.abort(), 2500);
          const r2 = await fetch(url, { method:'GET', headers:{ Range:'bytes=0-0' }, signal:c2.signal });
          clearTimeout(t2);
          if (aborted) return;
          if (r2.ok || [200,206].includes(r2.status)) { setStreamProbe({ status:'ok', code:r2.status }); return; }
          if (r2.status === 404) { setStreamProbe({ status:'nf', code:404 }); return; }
          setStreamProbe({ status:'err', code:r2.status||0 });
        } catch (e) {
          setStreamProbe({ status:'err', code:0 });
        }
      } catch (e) {
        if (!aborted) setStreamProbe({ status:'err', code:0 });
      }
    }
    probe(albumForm.streamAudioUrl);
    return () => { aborted = true; };
  }, [albumForm.streamAudioUrl]);

  function selectAlbumAudio(btnIdx) {
    if (audioUploadingIdx !== null) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      uploadAlbumAudio(file, btnIdx);
    };
    input.click();
  }

  // Selettori e DnD per TRACCE multiple
  function selectAlbumTracks() {
    if (tracksUploading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      await uploadMultipleTracks(files);
    };
    input.click();
  }

  

  // guessAudioExt helper moved to module scope

  async function uploadAlbumAudio(file, btnIdx) {
    try {
      const MAX_AUDIO = 100 * 1024 * 1024; // 100MB
      if (file.size > MAX_AUDIO) {
        alert(`Audio troppo grande: ${(file.size/1024/1024).toFixed(1)}MB. Limite ~${(MAX_AUDIO/1024/1024)}MB.`);
        return;
      }
      setAudioUploadingIdx(btnIdx);
      setAudioUploadPct(0);
      const artistSlug = slugify(name);
      const albumSlug = slugify(albumForm.title || 'singolo');
      const ext = guessAudioExt(file);
  const storagePath = `tracks/${artistSlug}/${albumSlug}_${Date.now()}.${ext}`;
  const storageRef = ref(storage, storagePath);
      const metadata = { contentType: file.type || `audio/${ext}` };
  await uploadWithFallback(storageRef, storagePath, file, metadata, (pct) => setAudioUploadPct(pct));
      const url = await getDownloadURL(storageRef);
      setAlbumForm(prev => ({
        ...prev,
        buttons: (prev.buttons || []).map((b, i) => i === btnIdx ? { ...b, link: url } : b)
      }));
    } catch (err) {
      console.error('Errore upload audio', err);
      alert('Errore upload audio: ' + (err && err.message ? err.message : err));
    } finally {
      setAudioUploadingIdx(null);
      setAudioUploadPct(0);
    }
  }

  async function uploadMultipleTracks(files) {
    if (tracksUploading) return;
    try {
      const MAX_AUDIO = 100 * 1024 * 1024; // 100MB per file
      const artistSlug = slugify(name);
      const albumSlug = slugify(albumForm.title || 'album');
      const total = files.length;
      setTracksUploading(true);
      setTracksProgress({ done: 0, total, last: 0 });
      const newTracks = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (file.size > MAX_AUDIO) {
          alert(`Traccia "${file.name}" troppo grande: ${(file.size/1024/1024).toFixed(1)}MB (max 100MB).`);
          continue;
        }
        const ext = guessAudioExt(file);
        const storagePath = `tracks/${artistSlug}/${albumSlug}_${Date.now()}_${i}.${ext}`;
        const storageRef = ref(storage, storagePath);
        const metadata = { contentType: file.type || `audio/${ext}` };
        await uploadWithFallback(storageRef, storagePath, file, metadata, (pct) => {
          setTracksProgress(p => ({ ...p, last: pct }));
        });
        const url = await getDownloadURL(storageRef);
        // Title default from filename without extension
        const base = file.name.replace(/\.[^.]+$/, '');
        newTracks.push({ title: base, link: url });
        setTracksProgress(p => ({ ...p, done: p.done + 1, last: 0 }));
      }
      if (newTracks.length) {
        setAlbumForm(prev => ({ ...prev, tracks: [...(prev.tracks || []), ...newTracks] }));
      }
    } catch (err) {
      console.error('Errore upload tracce multiple', err);
      alert('Errore durante il caricamento delle tracce: ' + (err?.message || err));
    } finally {
      setTracksUploading(false);
      setTracksProgress({ done: 0, total: 0, last: 0 });
    }
  }

  function handleTrackTitleChange(idx, title) {
    setAlbumForm(prev => ({ ...prev, tracks: (prev.tracks || []).map((t, i) => i === idx ? { ...t, title } : t) }));
  }
  function removeTrack(idx) {
    setAlbumForm(prev => ({ ...prev, tracks: (prev.tracks || []).filter((_, i) => i !== idx) }));
  }
  function moveTrack(idx, dir) {
    setAlbumForm(prev => {
      const arr = [...(prev.tracks || [])];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return prev;
      const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
      return { ...prev, tracks: arr };
    });
  }

  // Usa 'nome' se presente (è il campo salvato su Firestore), altrimenti fallback a 'name'
  const [name, setName] = useState(artist.nome || artist.name || "");
  const [bio, setBio] = useState(artist.bio || "");
  const [photo, setPhoto] = useState(artist.photo || null);
  const [steps, setSteps] = useState(artist.steps || [null, null, null]);
  const [albums, setAlbums] = useState(artist.albums || []);
  // Campi avanzati sempre visibili: niente toggle nascosto
  const [totalListens, setTotalListens] = useState(null);
  const [spotifyArtistUrl, setSpotifyArtistUrl] = useState(null);
  const [appleArtistUrl, setAppleArtistUrl] = useState(null);
  // Link manager (nascosti in semplice): manteniamo lo stato per non perdere dati
  const [managerSpotifyLink, setManagerSpotifyLink] = useState(artist.spotifyLink || '');
  const [managerAppleLink, setManagerAppleLink] = useState(artist.appleLink || '');

  // Solo aggiunta plays reali da streaming, senza toccare albums/cover esistenti
  useEffect(() => {
    if (simpleMode) return; // in modalità semplice non carichiamo dati streaming esterni
    let aborted = false;
    async function fetchStreaming() {
      try {
        // Preferisci nome estratto dal link Apple salvato (se presente), altrimenti usa nome artista
  let lookup = (artist.nome || artist.name || name || '').trim();
  const appleLinkForQuery = (managerAppleLink || artist.appleLink || '').trim();
  const spotifyLinkForQuery = (managerSpotifyLink || artist.spotifyLink || '').trim();
        if (appleLinkForQuery) {
          try {
            const m = appleLinkForQuery.match(/\/artist\/([^/]+)/i);
            if (m && m[1]) {
              const decoded = decodeURIComponent(m[1]).replace(/-/g, ' ').trim();
              if (decoded.length >= 2) lookup = decoded;
            }
          } catch {}
        }
        if (!lookup) return;
        const spotifyQuery = spotifyLinkForQuery || lookup;
        const appleQuery = appleLinkForQuery || lookup;
        const [sp, ap] = await Promise.all([
          fetchArtistData(spotifyQuery).catch(() => null),
          fetchAppleArtistData(appleQuery).catch(() => null)
        ]);
        if (process.env.NODE_ENV !== 'production') {
          try { console.info('[ArtistPageEditable] streaming data', { lookup, sp, ap }); } catch {}
        }
        if (aborted) return;
        const followers = (sp && sp.artist && typeof sp.artist.followers === 'number') ? sp.artist.followers : 0;
        const popularityBoost = (sp && sp.artist && typeof sp.artist.popularity === 'number') ? sp.artist.popularity * 1000 : 0;
        const previews = (ap && ap.topTracks) ? ap.topTracks.filter(t => Array.isArray(t.previews) && t.previews.length > 0).length : 0;
    const appleHeuristic = previews * 500;
    const total = followers + popularityBoost + appleHeuristic;
    setTotalListens(total); // mostra anche 0
        if (sp && sp.artist && sp.artist.url) setSpotifyArtistUrl(sp.artist.url);
        if (ap && ap.artist && ap.artist.url) setAppleArtistUrl(ap.artist.url);
      } catch {}
    }
    fetchStreaming();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.nome, artist?.name, managerAppleLink, simpleMode]);

  // Nessun caricamento da API streaming: manteniamo i dati album manuali come inseriti

  

  // Caricamento resiliente: prova resumable (con timeout+retry), poi semplice (raw) con retry (senza metadata) se fallisce o se forzato da env
  async function uploadWithFallback(storageRef, storagePath, data, metadata, onProgress, options = {}) {
    // Keep options for future tuning; not used directly to avoid lint noise
    const { timeoutMs = 120000, retries = 2, backoffBaseMs = 1000 } = options; // eslint-disable-line no-unused-vars

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

    let attemptedSigned = false;
    // 0) Prova prima Signed POST Policy (nessun preflight) se autenticati
    try {
      if (useSignedPost && auth && auth.currentUser) {
        await uploadWithSignedPost(storagePath, data, (metadata && metadata.contentType) || (data && data.type), onProgress);
        attemptedSigned = true;
        return;
      }
    } catch (e) {
      console.warn('[upload] signed POST fallita, passo ai fallback:', e && e.message ? e.message : e);
    }

    // 1) Tenta resumable se non forzato simple e non forzato fetch
    if (!forceSimpleUpload && !forceFetchUpload) {
      for (let attempt = 1; attempt <= (1 + retries); attempt++) {
        const tag = `[resumable ${attempt}/${1+retries}]`;
        try {
          if (process.env.NODE_ENV !== 'production') console.info('[upload] usando resumable', tag);
          await new Promise((resolve, reject) => {
            const task = uploadBytesResumable(storageRef, data, metadata);
            let timer = setTimeout(() => {
              try { task.cancel(); } catch {}
              reject(new Error('Timeout upload (resumable)'));
            }, timeoutMs);
            task.on('state_changed', (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              onProgress && onProgress(pct);
              clearTimeout(timer);
              timer = setTimeout(() => {
                try { task.cancel(); } catch {}
                reject(new Error('Timeout upload (resumable)'));
              }, timeoutMs);
            }, (err) => {
              clearTimeout(timer);
              reject(err);
            }, () => {
              clearTimeout(timer);
              resolve();
            });
          });
          return; // OK con resumable
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          console.warn('[uploadWithFallback]', tag, 'fallito:', msg);
          if (attempt < (1 + retries)) {
            const backoff = backoffBaseMs * attempt;
            await sleep(backoff);
            continue;
          }
        }
      }
      console.warn('[uploadWithFallback] passo a simple (raw) dopo fallimenti resumable');
    }

  // Simple (raw) senza metadata per evitare preflight; applica contentType sul Blob
    let rawData = data;
    try {
      const desiredType = metadata && metadata.contentType;
      const currentType = (data && data.type) || undefined;
      if (desiredType && desiredType !== currentType) {
        rawData = new Blob([data], { type: desiredType });
      }
    } catch {}


  // 3) Simple SDK con retry
  for (let attempt = 1; attempt <= (1 + retries); attempt++) {
      const tag = `[simple ${attempt}/${1+retries}]`;
      try {
        if (process.env.NODE_ENV !== 'production') console.info('[upload] usando simple (raw)', tag);
        await uploadBytes(storageRef, rawData);
        onProgress && onProgress(100);
        return;
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        console.warn('[uploadWithFallback]', tag, 'fallito:', msg);
        if (attempt < (1 + retries)) {
          const backoff = backoffBaseMs * attempt;
          await sleep(backoff);
          continue;
        }
        // Nessun altro fallback: interrompi e riporta errore
        // Prima di rinunciare, se non abbiamo provato Signed POST, prova ora (evita preflight/CORS)
        try {
          if (!attemptedSigned && auth && auth.currentUser) {
            console.warn('[uploadWithFallback] tentativo finale Signed POST');
            await uploadWithSignedPost(storagePath, data, (metadata && metadata.contentType) || (data && data.type), onProgress);
            attemptedSigned = true;
            return;
          }
        } catch (e2) {
          console.warn('[uploadWithFallback] Signed POST fallback fallito:', e2 && e2.message ? e2.message : e2);
        }
        throw e;
      }
    }
  }

  // Effetto: auto-inserisce nei pulsanti Spotify / Apple / YouTube gli URL già presenti o quelli importati
  useEffect(() => {
    setAlbums(prev => prev.map(alb => {
      if (!alb || !Array.isArray(alb.buttons)) return alb;
      // Assicura presenza dei pulsanti chiave
      let buttons = (alb.buttons || []).map(b => ({ ...b }));
      const ensureButton = (name) => {
        if (!buttons.some(b => (b.name || '').toLowerCase() === name.toLowerCase())) {
          buttons.push({ name, icon: null, link: '' });
        }
      };
      ensureButton('Spotify');
      ensureButton('Apple Music');
      ensureButton('YouTube');
      // Ricava eventuali URL importati traccia singola (Spotify / Apple) per usarli come link pulsante se mancante
      const spUrl = alb.spotifyTrackUrl || '';
      const apUrl = alb.appleTrackUrl || '';
      // Deriva YouTube da videoUrl se compatibile
      const ytUrl = (alb.videoUrl && /(youtube\.com|youtu\.be)\//i.test(alb.videoUrl)) ? alb.videoUrl : (alb.youtubeTrackUrl || '');
      // YouTube: se l'utente aveva già inserito manualmente un link in buttons lo manteniamo, altrimenti lasciamo vuoto.
      for (let btn of buttons) {
        const name = (btn.name || '').toLowerCase();
        if (name === 'spotify' && !btn.link && spUrl) btn.link = spUrl.trim();
        if ((name.includes('apple') || name === 'apple music') && !btn.link && apUrl) btn.link = apUrl.trim();
        if (name === 'youtube' && !btn.link && ytUrl) btn.link = ytUrl.trim();
      }
      return { ...alb, buttons };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalizza pulsanti streaming a partire dai riquadri URL
  function normalizeStreamingButtons(album) {
    let buttons = Array.isArray(album.buttons) ? album.buttons.map(b => ({ ...b })) : defaultButtons.map(b => ({ ...b }));
    const ensure = (name) => {
      if (!buttons.some(b => (b.name || '').toLowerCase() === name.toLowerCase())) buttons.push({ name, icon: null, link: '' });
    };
    ensure('Spotify');
    ensure('Apple Music');
    ensure('YouTube');
    const mapSet = (name, url) => {
      if (!url) return;
      const idx = buttons.findIndex(b => (b.name || '').toLowerCase() === name.toLowerCase());
      if (idx >= 0 && !buttons[idx].link) buttons[idx] = { ...buttons[idx], link: url.trim() };
    };
    mapSet('Spotify', album.spotifyTrackUrl);
    mapSet('Apple Music', album.appleTrackUrl);
    // YouTube: preferisci youtubeTrackUrl; se assente ma videoUrl è YouTube usalo
    const yPref = album.youtubeTrackUrl || (album.videoUrl && /(youtube\.com|youtu\.be)\//i.test(album.videoUrl) ? album.videoUrl : '');
    mapSet('YouTube', yPref);
    return { ...album, buttons };
  }

  // Upload diretto con Signed POST Policy (no Authorization, no preflight). Nessun progresso incrementale: aggiorna 100% a fine.
  async function uploadWithSignedPost(storagePath, data, contentType, onProgress) {
    // Richiedi la policy firmata lato server
    const callable = httpsCallable(functions, 'getUploadPolicy');
    const res = await callable({ path: storagePath, contentType: contentType || 'application/octet-stream' });
    const { url, fields } = (res && res.data) || {};
    if (!url || !fields) throw new Error('Policy upload mancante');
  const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    // La policy contiene una condizione su $Content-Type (starts-with), quindi il campo deve essere presente nel form
    // Alcuni browser impostano automaticamente il Content-Type della parte 'file' ma GCS richiede anche il campo esplicito.
    // Se non già presente tra i campi firmati, aggiungiamolo noi.
    const hasCT = Object.keys(fields).some(k => k.toLowerCase() === 'content-type');
    if (!hasCT) {
      form.append('Content-Type', contentType || 'application/octet-stream');
    }
  // Aggiungi un token di download Firebase in metadata, così getDownloadURL funziona subito
    const token = (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function')
      ? window.crypto.randomUUID()
      : (Math.random().toString(36).slice(2) + Date.now());
  form.append('x-goog-meta-firebaseStorageDownloadTokens', token);
  // Imposta status desiderato (201 o 204); 201 permette XML response
  form.append('success_action_status', '201');
  form.append('file', data);
    const resp = await fetch(url, { method: 'POST', body: form });
    if (!(resp.status === 204 || resp.status === 201 || resp.ok)) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Signed POST fallita: ${resp.status} ${txt}`);
    }
    onProgress && onProgress(100);
    return token;
  }

  

  // Helpers per upload immagini solo al momento del salvataggio
  function isDataUrl(v) {
    return typeof v === "string" && v.startsWith("data:");
  }

  const uploadCacheRef = useRef({}); // persiste tra i render

  function approxBase64Bytes(str) {
    if (!str || !isDataUrl(str)) return 0;
    // rimuovi header data:image/...;base64,
    const comma = str.indexOf(',');
    const b64 = comma >= 0 ? str.slice(comma + 1) : str;
    return Math.floor(b64.length * 0.75); // stima
  }

  // Converte dataURL -> Blob per usare upload resumable
  function dataUrlToBlob(dataUrl) {
    // Conversione manuale per evitare fetch(data:) che può essere bloccato o lento in alcuni contesti
    const comma = dataUrl.indexOf(',');
    const header = comma >= 0 ? dataUrl.slice(0, comma) : '';
    const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const mimeMatch = header.match(/data:([^;]+);base64/);
    const contentType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const byteChars = atob(b64);
    const len = byteChars.length;
    const byteNumbers = new Array(len);
    for (let i = 0; i < len; i++) byteNumbers[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  async function ensureUploaded(value, folder, callbacks = {}, options = {}) {
    if (!value) return value;
    if (!isDataUrl(value)) return value; // già URL o altro formato gestibile senza upload
    const uploadCache = uploadCacheRef.current;
    const { onStep, onProgress } = (typeof callbacks === 'function') ? { onStep: callbacks } : (callbacks || {});
    if (uploadCache[value]) {
      onStep && onStep('cache');
      onProgress && onProgress(100);
      return uploadCache[value];
    }

    const { timeoutMs = 120000, retries = 2, backoffBaseMs = 1000 } = options; // eslint-disable-line no-unused-vars

    // Prepara blob per leggere il contentType e dimensione reale stimata
    const blob = dataUrlToBlob(value);
    const contentType = blob.type || 'application/octet-stream';
    const isVideo = contentType.startsWith('video/');
    const isImage = contentType.startsWith('image/');
    const size = approxBase64Bytes(value);
    const maxBytes = isVideo ? 80 * 1024 * 1024 : 4 * 1024 * 1024; // 80MB per video, 4MB per immagini
    if (size > maxBytes) {
      const kind = isVideo ? 'Video' : 'Immagine';
      throw new Error(`${kind} troppo grande (${(size/1024/1024).toFixed(2)}MB). Limite ~${(maxBytes/1024/1024)}MB.`);
    }

  // sleep non usato in questa variante

    // Usa simple upload (uploadBytes) senza metadata per evitare preflight
    let ext = 'bin';
    if (isImage) ext = 'jpg';
    else if (isVideo) {
      if (contentType.includes('mp4')) ext = 'mp4';
      else if (contentType.includes('webm')) ext = 'webm';
      else if (contentType.includes('quicktime') || contentType.includes('mov')) ext = 'mov';
      else ext = 'mp4';
    }
    const storageRef = ref(storage, `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`);
    onStep && onStep('upload');
    await uploadBytes(storageRef, blob);
    onProgress && onProgress(100);
    onStep && onStep('url');
    const url = await getDownloadURL(storageRef);
    uploadCache[value] = url;
    return url;
  }

  const [saving, setSaving] = useState(false);
  const [errorSave, setErrorSave] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, phase: '' });
  const [itemProgress, setItemProgress] = useState({}); // { [key]: percent }
  const [savingItems, setSavingItems] = useState([]); // [{ key, label }]

  function updateProgress(partial) {
    setProgress(p => ({ ...p, ...partial }));
  }

  async function saveAll() {
    if (!onSave || saving) return;
    // Evita di salvare URL locali (127.0.0.1:9199) su Firestore di produzione
    const usingStorageEmu = process.env.REACT_APP_USE_STORAGE_EMULATOR === 'true';
    const usingFirestoreEmu = process.env.REACT_APP_USE_FIRESTORE_EMULATOR === 'true';
    if (usingStorageEmu && !usingFirestoreEmu) {
      const proceed = window.confirm('Stai usando lo Storage Emulator locale senza Firestore Emulator. Questo potrebbe salvare URL locali su Firestore di produzione. Vuoi procedere comunque?');
      if (!proceed) return;
    }
    setSaving(true);
    setErrorSave(null);
    updateProgress({ done: 0, total: 0, phase: 'Preparazione' });
    try {
      // In modalità ristretta, salviamo solo bio e foto
      if (restrictToBioAndPhoto) {
        updateProgress({ phase: 'Upload foto' });
        let processedPhoto = photo;
        if (photo && isDataUrl(photo)) {
          try {
            processedPhoto = await ensureUploaded(photo, 'artist-photo', {
              onProgress: (pct) => {
                // opzionale: progresso
              }
            });
          } catch (e) {
            console.error('Errore upload foto (restricted)', e);
            throw e;
          }
        }
        const payload = { bio, photo: processedPhoto };
        const maybePromise = artist.id ? onSave({ ...payload, id: artist.id }) : onSave(payload);
        if (maybePromise && typeof maybePromise.then === 'function') await maybePromise;
        updateProgress({ phase: 'Completato' });
        return;
      }

      // Determina se l'album in compilazione contiene dati significativi (modalità completa)
      const hasAlbumDraft = () => {
        const a = albumForm || {};
        const hasCover = !!a.cover;
        const hasMeta = (a.title && a.title.trim()) || (a.year && String(a.year).trim()) || (a.genre && a.genre.trim());
  const hasLinks = (a.downloadLink && a.downloadLink.trim()) || (a.paymentLinkUrl && a.paymentLinkUrl.trim()) || (a.videoUrl && a.videoUrl.trim());
        const hasButtons = Array.isArray(a.buttons) && a.buttons.some(b => b && b.link && String(b.link).trim());
        const hasTracks = Array.isArray(a.tracks) && a.tracks.length > 0;
        return !!(hasCover || hasMeta || hasLinks || hasButtons || hasTracks);
      };

      // Se stai modificando un album, incorpora l'albumForm nell'array; altrimenti, se c'è una bozza con dati, includila come nuovo album
      let albumsToSave = editingIdx !== null
        ? albums.map((a, i) => (i === editingIdx ? albumForm : a))
        : albums;
      if (editingIdx === null && hasAlbumDraft()) {
        albumsToSave = [...albumsToSave, albumForm];
      }
      // Prepara lista elementi da caricare
  console.log('[saveAll] Inizio preparazione elementi da caricare');
  const items = [];
      if (photo) items.push({ type: 'photo', value: photo, folder: 'artist-photo' });
      steps.forEach((s, i) => s && items.push({ type: `step_${i}`, value: s, folder: 'gallery', index: i }));
  albumsToSave.forEach((a, i) => a.cover && items.push({ type: `album_cover_${i}`, value: a.cover, folder: 'album-cover', index: i }));
  console.log('[saveAll] Tot elementi da processare:', items.length);
      updateProgress({ total: items.length, done: 0, phase: 'Upload' });

  // Inizializza progressi per item
      const initMap = {};
      const order = items.map(it => ({ key: it.type, label: it.type }));
      for (const it of items) initMap[it.type] = 0;
      setSavingItems(order);
      setItemProgress(initMap);

      let processedPhoto = photo;
    const processedSteps = [...steps];
    const processedAlbums = albumsToSave.map(a => ({ ...a }));

      let done = 0;
      for (const it of items) {
        updateProgress({ phase: `Upload ${it.type}`, done });
        try {
          const url = await ensureUploaded(it.value, it.folder, {
            onStep: (st) => {
              // st: 'upload' | 'url' | 'cache'
              if (st === 'cache') {
                setItemProgress(p => ({ ...p, [it.type]: 100 }));
              }
            },
            onProgress: (pct) => {
              setItemProgress(p => ({ ...p, [it.type]: pct }));
            }
          });
          if (it.type === 'photo') processedPhoto = url;
          else if (it.type.startsWith('step_')) processedSteps[it.index] = url;
          else if (it.type.startsWith('album_cover_')) processedAlbums[it.index].cover = url;
          console.log(`[saveAll] ${it.type} OK`);
        } catch (e) {
          console.error('Errore upload', it.type, e);
          throw e; // abort intero salvataggio per ora
        }
        done += 1;
        updateProgress({ done });
      }

  // Conversione link audio (gs:// -> https) nei bottoni album e gestione video
      updateProgress({ phase: 'Conversione link media' });
  const processedAlbumsWithButtons = [];
  for (const alb of processedAlbums) {
        const newButtons = [];
        for (const btn of alb.buttons || []) {
          if (btn.link && btn.link.startsWith('gs://')) {
            try {
              // Estrae path dopo bucket
              // Formati possibili: gs://bucket/path/to/file
              const parts = btn.link.replace('gs://', '').split('/');
              parts.shift(); // bucket non necessario qui
              const path = parts.join('/');
              if (!path) {
                console.warn('Link gs:// senza file:', btn.link);
                newButtons.push({ ...btn });
                continue;
              }
              // Usa solo path: il bucket reale è quello del nostro storage inizializzato
              const r = ref(storage, path);
              const realUrl = await getDownloadURL(r);
              newButtons.push({ ...btn, link: realUrl });
            } catch (err) {
              console.error('Errore conversione link gs://', btn.link, err);
              newButtons.push({ ...btn });
            }
          } else {
            newButtons.push({ ...btn });
          }
        }
        // Video: se data:, carica su Storage; se gs://, converti a https
        let newVideoUrl = alb.videoUrl || '';
        if (newVideoUrl && newVideoUrl.startsWith('data:')) {
          try {
            const uploaded = await ensureUploaded(newVideoUrl, 'album-video', {
              onProgress: (pct) => {
                // opzionale: potremmo mostrare una barra dedicata in futuro
              }
            }, { timeoutMs: 5 * 60 * 1000, retries: 2 });
            newVideoUrl = uploaded;
          } catch (err) {
            console.error('Errore upload video', err);
          }
        }
        if (newVideoUrl && newVideoUrl.startsWith('gs://')) {
          try {
            const partsV = newVideoUrl.replace('gs://', '').split('/');
            partsV.shift();
            const pathV = partsV.join('/');
            if (pathV) {
              const rV = ref(storage, pathV);
              newVideoUrl = await getDownloadURL(rV);
            }
          } catch (err) {
            console.error('Errore conversione video gs://', newVideoUrl, err);
          }
        }
        // Converti anche downloadLink (gs:// -> https)
        let newDownloadLink = alb.downloadLink || '';
        if (newDownloadLink && newDownloadLink.startsWith('gs://')) {
          try {
            const partsD = newDownloadLink.replace('gs://', '').split('/');
            partsD.shift();
            const pathD = partsD.join('/');
            if (pathD) {
              const rD = ref(storage, pathD);
              newDownloadLink = await getDownloadURL(rD);
            }
          } catch (err) {
            console.error('Errore conversione ZIP gs://', newDownloadLink, err);
          }
        }
        // Tracce: converti gs:// -> https
        let newTracks = Array.isArray(alb.tracks) ? [...alb.tracks] : [];
        const convertedTracks = [];
        for (const t of newTracks) {
          if (t && t.link && t.link.startsWith('gs://')) {
            try {
              const partsT = t.link.replace('gs://', '').split('/');
              partsT.shift();
              const pathT = partsT.join('/');
              if (pathT) {
                const rT = ref(storage, pathT);
                const real = await getDownloadURL(rT);
                convertedTracks.push({ title: t.title || '', link: real });
              } else {
                convertedTracks.push({ ...t });
              }
            } catch (err) {
              console.error('Errore conversione traccia gs://', t.link, err);
              convertedTracks.push({ ...t });
            }
          } else if (t && t.link) {
            convertedTracks.push({ ...t });
          }
        }
        
        processedAlbumsWithButtons.push({ ...alb, buttons: newButtons, videoUrl: newVideoUrl, downloadLink: newDownloadLink, tracks: convertedTracks });
      }

    updateProgress({ phase: 'Scrittura Firestore' });
  const payload = { nome: name, bio, photo: processedPhoto, steps: processedSteps, albums: processedAlbumsWithButtons };
  // Aggiungi i campi manager manuali se presenti (anche stringa vuota per chiarezza)
  payload.spotifyLink = managerSpotifyLink.trim();
  payload.appleLink = managerAppleLink.trim();
      console.log('[saveAll] Payload finale pronto, invio onSave', payload);
      const maybePromise = artist.id ? onSave({ ...payload, id: artist.id }) : onSave(payload);
      if (maybePromise && typeof maybePromise.then === 'function') {
        await maybePromise; // attendi eventuale async esterno
      }
      updateProgress({ phase: 'Completato' });
      console.log('[saveAll] Completato');
    } catch (e) {
      console.error('Errore salvataggio', e);
      setErrorSave(e.message || 'Errore sconosciuto');
    } finally {
      setSaving(false);
      // piccolo delay per mostrare completato
      setTimeout(() => {
        updateProgress({ phase: '', done: 0, total: 0 });
        setSavingItems([]);
        setItemProgress({});
      }, 1500);
    }
  }

  // Integrazione caricamento massivo: aggiunge tracce e imposta streamAudioUrl se vuoto
  function handleBulkTracks(list) {
    if (!Array.isArray(list) || list.length === 0) return;
    setAlbumForm(prev => {
      const merged = [...(prev.tracks || [])];
      list.forEach(item => {
        if (item && item.streamAudioUrl) {
          merged.push({ title: item.title || 'Traccia', link: item.streamAudioUrl });
        }
      });
      const ensureStream = prev.streamAudioUrl || (list[0] && list[0].streamAudioUrl) || '';
      return { ...prev, tracks: merged, streamAudioUrl: ensureStream };
    });
  }

  return (
    <div
      className="container"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        padding: "24px 8px",
        boxSizing: "border-box"
      }}
    >
      {/* Pulsante Salva sopra */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        {onSave && (
          <button
            style={{ padding: "10px 32px", background: "#ffd700", color: "#222", border: "none", borderRadius: 8, fontWeight: "bold", fontSize: "1.2em", cursor: "pointer" }}
            onClick={saveAll}
          >
            {saving ? (progress.phase ? `Salvataggio... ${progress.done}/${progress.total}` : 'Salvataggio...') : 'Salva'}
          </button>
        )}
      </div>
      {restrictToBioAndPhoto && (
        <div style={{ color:'#bbb', textAlign:'center', marginTop:-12, marginBottom:16, fontSize:12 }}>
          In questa dashboard puoi modificare solo Foto profilo e Biografia. Per tutto il resto contatta l’amministratore.
        </div>
      )}
      {(totalListens !== null || spotifyArtistUrl || appleArtistUrl || managerSpotifyLink || managerAppleLink) && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginTop:-4, marginBottom:12 }}>
          {totalListens !== null && (
            <div style={{ color:'#ffd700', fontSize:14, fontWeight:700 }}>
              {totalListens > 0 ? (
                <>Ascolti: {totalListens.toLocaleString('it-IT')}</>
              ) : (
                <>Ascolti streaming non disponibili</>
              )}
            </div>
          )}
          {/* Link dinamici streaming, sostituiscono manuali in editor vista elenco */}
          <div style={{ display:'flex', gap:12 }}>
            {(spotifyArtistUrl || managerSpotifyLink) && (
              <a href={spotifyArtistUrl || managerSpotifyLink} target="_blank" rel="noopener noreferrer" style={{ color:'#1DB954', fontSize:12, textDecoration:'none', fontWeight:600 }}>
                Ascolta su Spotify →
              </a>
            )}
            {(appleArtistUrl || managerAppleLink) && (
              <a href={appleArtistUrl || managerAppleLink} target="_blank" rel="noopener noreferrer" style={{ color:'#fff', fontSize:12, textDecoration:'none', fontWeight:600 }}>
                Ascolta su Apple Music →
              </a>
            )}
          </div>
        </div>
      )}
      {restrictToBioAndPhoto ? (
        <h2 style={{
          fontSize: "2.2em",
          textAlign: "center",
          color: "#ffd700",
          fontWeight: "bold",
          marginBottom: 18,
          width: "100%",
          maxWidth: 600
        }}>{artist.nome || artist.name || name || 'Artista'}</h2>
      ) : (
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Nome Artista"
          style={{
            fontSize: "2.6em",
            textAlign: "center",
            color: "#ffd700",
            fontWeight: "bold",
            marginBottom: 28,
            border: "none",
            background: "transparent",
            width: "100%",
            maxWidth: 600
          }}
        />
      )}

      {/* Manager manual streaming profile links (Spotify / Apple) */}
      {!simpleMode && (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:'100%', maxWidth:640, marginBottom:24 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%', maxWidth:640 }}>
          <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:'100%' }}>
            <span style={{ color:'#ffd700', fontSize:14, fontWeight:600 }}>Manager Link Spotify Artist</span>
            {restrictToBioAndPhoto ? (
              <input
                type="url"
                readOnly
                value={managerSpotifyLink}
                placeholder="https://open.spotify.com/artist/…"
                style={{ width:'100%', maxWidth:600, background:'#111', color:'#ccc', border:'1px solid #333', borderRadius:8, padding:'8px 12px', fontSize:14, textAlign:'center' }}
              />
            ) : (
              <input
                type="url"
                value={managerSpotifyLink}
                onChange={e => setManagerSpotifyLink(e.target.value)}
                placeholder="https://open.spotify.com/artist/…"
                style={{ width:'100%', maxWidth:600, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:8, padding:'8px 12px', fontSize:14, textAlign:'center' }}
              />
            )}
          </label>
          <label style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:'100%' }}>
            <span style={{ color:'#ffd700', fontSize:14, fontWeight:600 }}>Manager Link Apple Music Artist</span>
            {restrictToBioAndPhoto ? (
              <input
                type="url"
                readOnly
                value={managerAppleLink}
                placeholder="https://music.apple.com/it/artist/…/ID"
                style={{ width:'100%', maxWidth:600, background:'#111', color:'#ccc', border:'1px solid #333', borderRadius:8, padding:'8px 12px', fontSize:14, textAlign:'center' }}
              />
            ) : (
              <input
                type="url"
                value={managerAppleLink}
                onChange={e => setManagerAppleLink(e.target.value)}
                placeholder="https://music.apple.com/it/artist/…/ID"
                style={{ width:'100%', maxWidth:600, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:8, padding:'8px 12px', fontSize:14, textAlign:'center' }}
              />
            )}
          </label>
          <div style={{ color:'#888', fontSize:11, textAlign:'center', maxWidth:600 }}>
            Inserisci l'URL completo del profilo artista (non il singolo brano). Verrà usato come fallback se le API non restituiscono il link.
          </div>
        </div>
  </div>
  )}

      {/* Steps images upload (hidden if hideSteps) */}
      {!hideSteps && !restrictToBioAndPhoto && !simpleMode && (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 24 }}>
            {steps.map((img, idx) => (
              <div
                key={idx}
                onDrop={handleStepImageDrop(idx)}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: "2px dashed #ffd700",
                  borderRadius: 12,
                  width: 120,
                  height: 120,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#222",
                  position: "relative"
                }}
              >
                {img ? (
                  <img src={img} alt={`Step ${idx + 1}`} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10, boxShadow: "0 0 8px #ffd700" }} />
                ) : (
                  <span style={{ color: "#ffd700", textAlign: "center", fontSize: "0.95em" }}>Trascina qui immagine {idx + 1}</span>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: -12, marginBottom: 24 }}>
            {steps.map((_, idx) => (
              <button key={`pick_${idx}`} onClick={() => selectStep(idx)} style={{ background: '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Seleziona {idx + 1}</button>
            ))}
          </div>
        </>
      )}
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        placeholder="Biografia"
        style={{
          width: "100%",
          maxWidth: 600,
          fontSize: "1.5em",
          lineHeight: 1.6,
          borderRadius: 12,
          border: "2px solid #ffd700",
          background: "#111",
          color: "#fff",
          padding: 20,
          boxSizing: "border-box",
          minHeight: 200,
          margin: "0 auto 32px auto",
          display: "block",
          textAlign: "center"
        }}
      />
      {!restrictToBioAndPhoto && (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: 600,
          marginBottom: 32
        }}
      >
        <div
          onDrop={handleImageDrop(setPhoto)}
          onDragOver={e => e.preventDefault()}
          style={{
            border: "2px dashed #ffd700",
            borderRadius: 18,
            width: 320,
            height: 400,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#222",
            margin: "0 auto",
            position: "relative"
          }}
        >
          {photo ? (
            <img src={photo} alt="Foto artista" className="artist-photo" style={{ width: 320, height: 400, objectFit: "cover", borderRadius: 16, boxShadow: "0 0 16px #ffd700" }} />
          ) : (
            <span style={{ color: "#ffd700", textAlign: "center", fontSize: "1.2em" }}>Trascina qui la foto artista</span>
          )}
        </div>
        <button onClick={selectPhoto} style={{ marginTop: 8, background: '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Seleziona foto</button>
  </div>
  )}

  {/* Album/cover/disco management (nascosto in modalità ristretta) */}
  {!restrictToBioAndPhoto && (
  <div style={{ width: "100%", maxWidth: 700, margin: "0 auto 32px auto" }}>
        <h3 style={{ color: "#ffd700", textAlign: "center", marginBottom: 16 }}>Dischi / Cover</h3>
        {simpleMode && (
          <BulkTrackUploader artistName={name || artist.nome || artist.name || 'artista'} onComplete={handleBulkTracks} />
        )}
        {albums.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {albums.map((album, idx) => {
              const albumKey = album && album.title ? `alb_${album.title}_${album.year || idx}` : `alb_${idx}`;
              return (
              <li key={albumKey} style={{ background: "#222", borderRadius: 12, marginBottom: 18, padding: 18, boxShadow: "0 0 12px #ffd700" }}>
                <div style={{ display: "flex", flexDirection: "row", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                  {album.cover && (
                    <img src={album.cover} alt={album.title} style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 10, boxShadow: "0 0 8px #ffd700" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", color: "#ffd700", fontSize: "1.2em" }}>{album.title}</div>
                    <div style={{ color: "#fff", fontSize: "1em" }}>Anno: {album.year} | Genere: {album.genre}</div>
                    {!simpleMode && (
                      <div style={{ display: "flex", gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {album.buttons.map((btn, bidx) => {
                          const k = btn && btn.name ? btn.name : `btn_${bidx}`;
                          return (
                            <span key={k} style={{ display: "inline-flex", alignItems: 'center' }}>
                              {btn.name === "Buy & Download"
                                ? (
                                  btn.link ? (
                                    <a href={btn.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#222', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>
                                      <Icon name="Download" size={14} />
                                      <span>Download</span>
                                    </a>
                                  ) : null
                                ) : (
                                  btn.link ? (
                                    <a href={btn.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#222', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>
                                      <Icon name={btn.name} size={14} />
                                      <span>{btn.name}</span>
                                    </a>
                                  ) : null
                                )}
                            </span>
                          );
                        })}
                        {/* Link dinamici streaming */}
                        {(spotifyArtistUrl || managerSpotifyLink) && (
                          <span style={{ display:'inline-flex', alignItems:'center' }}>
                            <a href={spotifyArtistUrl || managerSpotifyLink} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#222', color:'#1DB954', border:'1px solid #1DB954', borderRadius:6, padding:'4px 8px', fontSize:12, textDecoration:'none', fontWeight:600 }}>
                              <Icon name="Spotify" size={14} />
                              <span>Spotify</span>
                            </a>
                          </span>
                        )}
                        {(appleArtistUrl || managerAppleLink) && (
                          <span style={{ display:'inline-flex', alignItems:'center' }}>
                            <a href={appleArtistUrl || managerAppleLink} target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#222', color:'#fff', border:'1px solid #555', borderRadius:6, padding:'4px 8px', fontSize:12, textDecoration:'none', fontWeight:600 }}>
                              <Icon name="Apple Music" size={14} />
                              <span>Apple</span>
                            </a>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button style={{ background: "#ffd700", color: "#222", border: "none", borderRadius: 6, padding: "6px 14px", fontWeight: "bold", cursor: "pointer" }} onClick={() => handleEditAlbum(idx)}>Modifica</button>
                    <button style={{ background: "#222", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, padding: "6px 14px", fontWeight: "bold", cursor: "pointer" }} onClick={() => handleRemoveAlbum(idx)}>Elimina</button>
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
        {/* Album form */}
        <div style={{ background: "#111", borderRadius: 12, padding: 18, boxShadow: "0 0 8px #ffd700", marginTop: 12 }}>
          <h4 style={{ color: "#ffd700", textAlign: "center" }}>{editingIdx !== null ? "Modifica Disco/Cover" : "Aggiungi Disco/Cover"}</h4>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div
              onDrop={handleAlbumCoverDrop}
              onDragOver={e => e.preventDefault()}
              style={{ border: "2px dashed #ffd700", borderRadius: 12, width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", background: "#222", position: "relative" }}
            >
              {albumForm.cover ? (
                <img src={albumForm.cover} alt="Cover" style={{ width: 180, height: 180, objectFit: "cover", borderRadius: 12, boxShadow: "0 0 8px #ffd700" }} />
              ) : (
                <span style={{ color: "#ffd700", textAlign: "center" }}>Trascina qui la cover</span>
              )}
            </div>
            <button onClick={selectAlbumCover} style={{ marginTop: 8, background: '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Seleziona cover</button>
            <input type="text" value={albumForm.title} onChange={e => handleAlbumField("title", e.target.value)} placeholder="Titolo" style={{ width: 220, fontSize: "1.1em", background: "#111", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, textAlign: "center", marginBottom: 6 }} />
            <input type="text" value={albumForm.year} onChange={e => handleAlbumField("year", e.target.value)} placeholder="Anno" style={{ width: 120, fontSize: "1.1em", background: "#111", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, textAlign: "center", marginBottom: 6 }} />
            <input type="text" value={albumForm.genre} onChange={e => handleAlbumField("genre", e.target.value)} placeholder="Genere" style={{ width: 180, fontSize: "1.1em", background: "#111", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, textAlign: "center", marginBottom: 6 }} />
            {/* METADATA FIELDS avanzati sempre visibili */}
            {true && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:10, justifyContent:'center', marginTop:8 }}>
                <input type="text" value={albumForm.upc} onChange={e=>handleAlbumField('upc', e.target.value)} placeholder="UPC" style={{ width:140, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.releaseId} onChange={e=>handleAlbumField('releaseId', e.target.value)} placeholder="Release ID" style={{ width:140, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.publicationType} onChange={e=>handleAlbumField('publicationType', e.target.value)} placeholder="Tipo Pubblicazione" style={{ width:160, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="date" value={albumForm.publicationDate} onChange={e=>handleAlbumField('publicationDate', e.target.value)} placeholder="Data" style={{ width:150, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.composerName} onChange={e=>handleAlbumField('composerName', e.target.value)} placeholder="Compositore" style={{ width:160, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.composerIpi} onChange={e=>handleAlbumField('composerIpi', e.target.value)} placeholder="IPI" style={{ width:100, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.siaePosition} onChange={e=>handleAlbumField('siaePosition', e.target.value)} placeholder="Pos. SIAE" style={{ width:110, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.drmCode} onChange={e=>handleAlbumField('drmCode', e.target.value)} placeholder="DRM" style={{ width:90, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                <input type="text" value={albumForm.isrc} onChange={e=>handleAlbumField('isrc', e.target.value)} placeholder="ISRC" style={{ width:120, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'6px 8px', fontSize:12, textAlign:'center' }} />
                {/* Autogenerazione codici */}
                <div style={{ width:'100%', background:'#181818', border:'1px solid #333', borderRadius:10, padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', justifyContent:'center' }}>
                    <label style={{ color:'#ffd700', fontSize:12, display:'flex', flexDirection:'column' }}>Paese
                      <input type='text' value={autoGen.country} onChange={e=>setAutoGen(a=>({ ...a, country: e.target.value.toUpperCase().slice(0,2) }))} style={{ width:70, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'4px 6px', fontSize:12, textAlign:'center' }} />
                    </label>
                    <label style={{ color:'#ffd700', fontSize:12, display:'flex', flexDirection:'column' }}>Label
                      <input type='text' value={autoGen.label} onChange={e=>setAutoGen(a=>({ ...a, label: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5) }))} style={{ width:90, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'4px 6px', fontSize:12, textAlign:'center' }} />
                    </label>
                    <label style={{ color:'#ffd700', fontSize:12, display:'flex', flexDirection:'column' }}>Anno(2)
                      <input type='text' value={autoGen.year2d} onChange={e=>setAutoGen(a=>({ ...a, year2d: e.target.value.replace(/[^0-9]/g,'').slice(-2) }))} style={{ width:60, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'4px 6px', fontSize:12, textAlign:'center' }} />
                    </label>
                    <label style={{ color:'#ffd700', fontSize:12, display:'flex', flexDirection:'column' }}>Start N°
                      <input type='number' min={1} value={autoGen.startSeq} onChange={e=>setAutoGen(a=>({ ...a, startSeq: Math.max(1, parseInt(e.target.value||'1',10)) }))} style={{ width:70, background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:6, padding:'4px 6px', fontSize:12, textAlign:'center' }} />
                    </label>
                    <label style={{ color:'#ffd700', fontSize:12, display:'flex', flexDirection:'column' }}>Auto
                      <input type='checkbox' checked={autoGen.enabled} onChange={e=>setAutoGen(a=>({ ...a, enabled: e.target.checked }))} style={{ width:18, height:18 }} />
                    </label>
                    <button type='button' onClick={() => {
                      // Preview generazione senza salvare
                      const seq = String(autoGen.startSeq).padStart(5,'0');
                      const previewIsrc = `${autoGen.country}-${autoGen.label}-${autoGen.year2d}-${seq}`.toUpperCase().replace(/[^A-Z0-9-]/g,'');
                      if (!albumForm.isrc) handleAlbumField('isrc', previewIsrc);
                      if (!albumForm.upc) {
                        const base = `${autoGen.country}${autoGen.label}${autoGen.year2d}`.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
                        const rand = String(Math.floor(Math.random()*100000)).padStart(5,'0');
                        handleAlbumField('upc', (base + rand).slice(0,20));
                      }
                    }} style={{ background:'#222', color:'#ffd700', border:'1px solid #444', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:12 }}>Autogenera ora</button>
                  </div>
                  <div style={{ width:'100%', color:'#999', fontSize:10, textAlign:'center' }}>
                    Se spunti "Auto" la generazione avverrà automaticamente al Salva se UPC/ISRC sono vuoti.
                  </div>
                </div>
                <div style={{ width:'100%', color:'#999', fontSize:11, textAlign:'center', marginTop:4 }}>
                  Nota: per streaming e download sul tuo sito bastano Streaming URL e (se vendi) Payment Link + WAV master. UPC/ISRC/SIAE/IPI non sono obbligatori qui;
                  ISRC è consigliato per distribuzione su DSP, UPC per l’album; SIAE/IPI utili per reportistica; DRM quasi mai necessario.
                </div>
              </div>
            )}
            {/* Toggle rimosso */}
            {/* AUDIO ASSET UPLOADS */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginTop:18 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center' }}>
                <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:10, padding:12, minWidth:240, textAlign:'center' }}>
                  <div style={{ color:'#ffd700', fontSize:13, fontWeight:600 }}>Streaming (MP3/AAC/WAV)</div>
                  {albumForm.streamAudioUrl ? (
                    <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:6 }}>
                      <a href={albumForm.streamAudioUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#ffd700', textDecoration:'underline', fontSize:12 }}>Apri Streaming</a>
                      {streamProbe.status === 'ok' && (
                        <div style={{ color:'#70bd89', fontSize:11 }}>Link attivo ✓</div>
                      )}
                      {streamProbe.status === 'nf' && (
                        <div style={{ color:'#ff8585', fontSize:11 }}>Attenzione: il file non esiste (404). Carica un nuovo streaming.</div>
                      )}
                      {streamProbe.status === 'err' && (
                        <div style={{ color:'#ffcc66', fontSize:11 }}>Impossibile verificare il link ora. Assicurati che sia corretto.</div>
                      )}
                      <button type="button" onClick={() => handleAlbumField('streamAudioUrl','')} style={{ background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>Rimuovi</button>
                    </div>
                  ) : (
                    <button type="button" disabled={audioUploadingIdx==='preview'} onClick={() => {
                      const input = document.createElement('input');
                      input.type='file'; input.accept='audio/*,.mp3,.m4a,.aac,.wav';
                      input.onchange=()=>{ const f=input.files&&input.files[0]; if(f) uploadAlbumStreaming(f); };
                      input.click();
                    }} style={{ marginTop:8, background: audioUploadingIdx==='stream' ? '#555' : '#222', color:'#ffd700', border:'1px solid #ffd700', borderRadius:6, padding:'6px 12px', fontSize:12, cursor: audioUploadingIdx==='stream' ? 'not-allowed' : 'pointer' }}>
                      {audioUploadingIdx==='stream' ? `Upload ${audioUploadPct}%` : 'Carica Streaming'}
                    </button>
                  )}
                </div>
                <div style={{ background:'#1a1a1a', border:'1px solid #333', borderRadius:10, padding:12, minWidth:240, textAlign:'center' }}>
                  <div style={{ color:'#ffd700', fontSize:13, fontWeight:600 }}>Master WAV (Download)</div>
                  {albumForm.fullAudioUrl ? (
                    <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:6 }}>
                      <a href={albumForm.fullAudioUrl} target="_blank" rel="noopener noreferrer" style={{ color:'#ffd700', textDecoration:'underline', fontSize:12 }}>Apri WAV</a>
                      <button type="button" onClick={() => { handleAlbumField('fullAudioUrl',''); handleAlbumField('downloadLink',''); }} style={{ background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>Rimuovi</button>
                    </div>
                  ) : (
                    <button type="button" disabled={zipUploading} onClick={() => {
                      if(zipUploading) return; const input=document.createElement('input'); input.type='file'; input.accept='audio/wav,.wav'; input.onchange=()=>{ const f=input.files&&input.files[0]; if(f) uploadAlbumWavMaster(f); }; input.click();
                    }} style={{ marginTop:8, background: zipUploading ? '#555' : '#222', color:'#ffd700', border:'1px solid #ffd700', borderRadius:6, padding:'6px 12px', fontSize:12, cursor: zipUploading ? 'not-allowed' : 'pointer' }}>
                      {zipUploading ? `Upload ${zipUploadPct}%` : 'Carica WAV'}
                    </button>
                  )}
                  {zipUploading && (
                    <div style={{ width:'100%', marginTop:6 }}>
                      <div style={{ color:'#bbb', fontSize:11 }}>Caricamento WAV: {zipUploadPct}%</div>
                      <div style={{ width:'100%', height:6, background:'#333', borderRadius:4, overflow:'hidden', border:'1px solid #444' }}>
                        <div style={{ width:`${zipUploadPct}%`, height:'100%', background:'#ffd700', transition:'width .2s' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ color:'#777', fontSize:11, marginTop:4, textAlign:'center', maxWidth:560 }}>
                Carica lo streaming completo (MP3/AAC consigliato; WAV consentito fino a ~200MB). Per il download acquistato carica il master WAV dedicato.
                Il campo DownloadLink punta al WAV master.
              </div>
            </div>
            {/* Pagamenti: Stripe Payment Link sempre visibile (se non nascosto da prop) */}
            {!hideStripePaymentLink && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <input
                  type="text"
                  value={albumForm.paymentLinkUrl || ''}
                  onChange={e => handleAlbumField('paymentLinkUrl', e.target.value)}
                  placeholder="Stripe Payment Link URL"
                  style={{ width: 280, fontSize: '1.0em', background: '#111', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, textAlign: 'center' }}
                />
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', justifyContent:'center', width:'100%' }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/download-confirm?cm=${encodeURIComponent((artist && artist.id) || '')}:${editingIdx !== null ? editingIdx : (albums.length)}`}
                    title="Imposta questo URL come Success URL in Stripe Payment Link"
                    style={{ flex:'1 1 auto', minWidth:260, maxWidth:360, padding:8, borderRadius:8, border:'1px solid #333', background:'#0b0b0b', color:'#ccc', textAlign:'center' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/download-confirm?cm=${encodeURIComponent((artist && artist.id) || '')}:${editingIdx !== null ? editingIdx : (albums.length)}`;
                      navigator.clipboard.writeText(url);
                      alert('Success URL copiato. Incollalo nel campo success_url del Payment Link su Stripe.');
                    }}
                    style={{ background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}
                  >
                    Copia Success URL
                  </button>
                </div>
                <div style={{ fontSize:11, color:'#999', textAlign:'center', maxWidth:420 }}>
                  Suggerimento: in Stripe → Payment Links, imposta il “Success URL” con quello sopra.
                  Dopo il pagamento, l’utente verrà reindirizzato alla pagina di download del tuo disco/singolo.
                </div>
              </div>
            )}
            {/* Campo PayPal rimosso: usiamo solo Stripe Payment Link */}
            {/* Video rimosso in modalità semplice */}
            {!simpleMode && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={albumForm.videoUrl || ''}
                  onChange={e => handleAlbumField('videoUrl', e.target.value)}
                  placeholder="Video URL (opzionale)"
                  style={{ width: 280, fontSize: '1.0em', background: '#111', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, textAlign: 'center' }}
                />
                <button onClick={selectAlbumVideo} style={{ background: '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>Carica video</button>
                {albumForm.videoUrl && albumForm.videoUrl.startsWith('data:') && (
                  <span style={{ color: '#bbb', fontSize: 12 }}>Video pronto per upload al Salva</span>
                )}
              </div>
            )}
            {/* Tracce multiple: drag&drop e selezione */}
            <div style={{ marginTop: 10, width: '100%', maxWidth: 520 }}
                 onDragOver={(e) => e.preventDefault()}
                 onDrop={(e) => { e.preventDefault(); const fs = Array.from(e.dataTransfer.files||[]).filter(f => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg)$/i.test(f.name)); if (fs.length) uploadMultipleTracks(fs); }}>
              <div style={{ border: '2px dashed #ffd700', borderRadius: 10, padding: 12, textAlign: 'center', color: '#ffd700', background: '#111' }}>
                Trascina qui più tracce audio oppure
                <button type="button" onClick={selectAlbumTracks} style={{ marginLeft: 8, background: '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Seleziona dal computer</button>
              </div>
              {tracksUploading && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: '#bbb', fontSize: 12 }}>Caricamento tracce: {tracksProgress.done}/{tracksProgress.total} {tracksProgress.last ? `(${tracksProgress.last}%)` : ''}</div>
                  <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', border: '1px solid #444' }}>
                    <div style={{ width: `${Math.min(100, ((tracksProgress.done + (tracksProgress.last/100)) / Math.max(1, tracksProgress.total)) * 100)}%`, height: '100%', background: '#ffd700', transition: 'width 0.2s' }} />
                  </div>
                </div>
              )}
              {(albumForm.tracks || []).length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
                  {albumForm.tracks.map((t, i) => (
                    <li key={`t_${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#222', color: '#ffd700', borderRadius: 8, padding: '6px 8px', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{i+1}.</span>
                      <input type="text" value={t.title || ''} onChange={(e) => handleTrackTitleChange(i, e.target.value)} placeholder="Titolo traccia" style={{ flex: 1, background: '#111', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 8px' }} />
                      <a href={t.link} target="_blank" rel="noopener noreferrer" style={{ color: '#ffd700', fontSize: 12, textDecoration: 'underline' }}>Apri</a>
                      <button type="button" onClick={() => moveTrack(i, -1)} disabled={i===0} title="Su" style={{ background: '#222', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 6px' }}>↑</button>
                      <button type="button" onClick={() => moveTrack(i, +1)} disabled={i===(albumForm.tracks.length-1)} title="Giù" style={{ background: '#222', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 6px' }}>↓</button>
                      <button type="button" onClick={() => removeTrack(i)} title="Rimuovi" style={{ background: '#222', color: '#ffd700', border: '1px solid #ff4d4f', borderRadius: 6, padding: '4px 6px' }}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* Import Spotify/Apple/YouTube rimossi in modalità semplice */}
            {!simpleMode && (
            <>
            {/* Riquadro collegamento traccia Spotify */}
            <div style={{ width:'100%', maxWidth:520, marginTop:20, background:'#181818', border:'1px solid #444', borderRadius:12, padding:14, boxShadow:'0 0 10px rgba(0,0,0,0.4)' }}>
              <h5 style={{ margin:'0 0 10px', color:'#1DB954', fontSize:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:26, height:26, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'#1DB954', color:'#fff', borderRadius:6, fontSize:14, fontWeight:700 }}>S</span>
                Traccia Spotify → Metadati & Anteprima
              </h5>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input
                  type="text"
                  value={albumForm.spotifyTrackUrl || ''}
                  onChange={e => handleAlbumField('spotifyTrackUrl', e.target.value)}
                  placeholder="Incolla URL traccia Spotify (https://open.spotify.com/track/...) oppure ID"
                  style={{ width:'100%', background:'#111', color:'#1DB954', border:'1px solid #1DB954', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                />
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const raw = (albumForm.spotifyTrackUrl || '').trim();
                      if (!raw) { alert('Inserisci prima un URL o un ID di traccia Spotify.'); return; }
                      try {
                        handleAlbumField('spotifyImported', false);
                        handleAlbumField('spotifyTrackPreview', '');
                        handleAlbumField('spotifyTrackTitle', '');
                        const { fetchSpotifyTrackData } = await import('./firebase');
                        const data = await fetchSpotifyTrackData(raw, 'IT');
                        if (!data || !data.found) {
                          alert('Traccia non trovata via API Spotify.');
                          return;
                        }
                        const t = data.track;
                        handleAlbumField('spotifyImported', true);
                        handleAlbumField('spotifyTrackTitle', t.name || '');
                        handleAlbumField('spotifyTrackPreview', t.preview_url || '');
                        // Manteniamo il link nel campo; il pulsante verrà creato/aggiornato al Salva
                        // Se non c'è cover album corrente prova a prendere l'immagine traccia
                        if (!albumForm.cover && t.album && Array.isArray(t.album.images) && t.album.images[0]?.url) {
                          handleAlbumField('cover', t.album.images[0].url);
                        }
                        // Se anteprima disponibile e non già presente in tracks aggiungi una traccia preview
                        if (t.preview_url) {
                          const exists = (albumForm.tracks||[]).some(x => x.link === t.preview_url);
                          if (!exists) {
                            setAlbumForm(prev => ({ ...prev, tracks: [...(prev.tracks||[]), { title: t.name || 'Preview', link: t.preview_url }] }));
                          }
                          // Crea/aggiorna anche la traccia nella subcollection per il player del sito
                          try {
                            if (artist && artist.id) {
                              const trackId = `sp_${t.id}`;
                              await fsSetDoc(fsDoc(db, 'artisti', artist.id, 'tracks', trackId), {
                                title: t.name || 'Spotify Preview',
                                previewAudioUrl: t.preview_url,
                                fullAudioUrl: '',
                                downloadLink: '',
                                paymentLinkUrl: '',
                                source: 'spotify',
                                createdAt: fsServerTimestamp()
                              }, { merge: true });
                            }
                          } catch (w) {
                            console.warn('Scrittura subcollection tracce fallita (non bloccante)', w?.message || w);
                          }
                        }
                      } catch (err) {
                        console.error('Errore import Spotify track', err);
                        const msg = String(err?.message || err || '');
                        // Fallback senza API: salva il link e prova a ricavare titolo via oEmbed
                        if (/spotify|config|clientid|non configurato/i.test(msg)) {
                          try {
                            // Costruisci URL completo se l'utente ha inserito solo l'ID
                            let url = raw;
                            if (/^[A-Za-z0-9]{22}$/.test(raw)) url = `https://open.spotify.com/track/${raw}`;
                            handleAlbumField('spotifyTrackUrl', url);
                            // Best‑effort: prendi titolo da oEmbed (se CORS consente)
                            try {
                              const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
                              if (r.ok) {
                                const j = await r.json();
                                if (j?.title) handleAlbumField('spotifyTrackTitle', j.title);
                              }
                            } catch {}
                            alert('Link Spotify salvato nel riquadro. Metadati limitati perché Spotify non è configurato. Premi Salva per aggiornare i pulsanti.');
                          } catch (e2) {
                            alert('Spotify non configurato. Ho lasciato il link nel campo.');
                          }
                        } else {
                          alert('Errore importazione traccia: ' + msg);
                        }
                      }
                    }}
                    style={{ background:'#1DB954', color:'#000', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, cursor:'pointer', boxShadow:'0 0 10px rgba(29,185,84,0.5)', fontSize:13 }}
                  >Importa Metadati</button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      handleAlbumField('spotifyTrackUrl','');
                      handleAlbumField('spotifyImported', false);
                      handleAlbumField('spotifyTrackPreview','');
                      handleAlbumField('spotifyTrackTitle','');
                    }}
                    style={{ background:'#222', color:'#1DB954', border:'1px solid #1DB954', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                  >Reset</button>
                  {albumForm.spotifyTrackPreview && (
                    <button
                      type="button"
                      onClick={() => window.open(albumForm.spotifyTrackPreview,'_blank','noopener,noreferrer')}
                      style={{ background:'#111', color:'#1DB954', border:'1px solid #1DB954', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                    >Anteprima</button>
                  )}
                </div>
                {albumForm.spotifyImported ? (
                  <div style={{ background:'#0e2a18', border:'1px solid #1DB954', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:13, color:'#1DB954', fontWeight:600 }}>Metadati importati</div>
                    <div style={{ fontSize:12, color:'#b5ffcf' }}>Titolo: {albumForm.spotifyTrackTitle || '—'}</div>
                    <div style={{ fontSize:12, color:'#b5ffcf' }}>Preview URL: {albumForm.spotifyTrackPreview ? <a href={albumForm.spotifyTrackPreview} target="_blank" rel="noreferrer" style={{ color:'#1DB954', textDecoration:'underline' }}>Apri</a> : 'non disponibile'}</div>
                    <div style={{ fontSize:11, color:'#70bd89' }}>Salva per rendere permanenti i metadati e la copertina.</div>
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:'#888' }}>Incolla l'URL della traccia Spotify e premi "Importa Metadati" per riempire titolo, anteprima e copertina (se mancante).</div>
                )}
              </div>
            </div>
            {/* Riquadro collegamento traccia Apple Music */}
            <div style={{ width:'100%', maxWidth:520, marginTop:16, background:'#171717', border:'1px solid #444', borderRadius:12, padding:14, boxShadow:'0 0 10px rgba(0,0,0,0.35)' }}>
              <h5 style={{ margin:'0 0 10px', color:'#fff', fontSize:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:26, height:26, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'#000', color:'#fff', borderRadius:6, fontSize:14, fontWeight:700 }}></span>
                Traccia Apple Music → Metadati & Anteprima
              </h5>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input
                  type="text"
                  value={albumForm.appleTrackUrl || ''}
                  onChange={e => handleAlbumField('appleTrackUrl', e.target.value)}
                  placeholder="Incolla URL traccia Apple (https://music.apple.com/it/song/...) oppure ID"
                  style={{ width:'100%', background:'#111', color:'#fff', border:'1px solid #888', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                />
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const raw = (albumForm.appleTrackUrl || '').trim();
                      if (!raw) { alert('Inserisci prima un URL o un ID di traccia Apple.'); return; }
                      try {
                        handleAlbumField('appleImported', false);
                        handleAlbumField('appleTrackPreview', '');
                        handleAlbumField('appleTrackTitle', '');
                        const { fetchAppleTrackData } = await import('./firebase');
                        const data = await fetchAppleTrackData(raw, 'it');
                        if (!data || !data.found) {
                          alert('Traccia non trovata via API Apple Music.');
                          return;
                        }
                        const t = data.track;
                        handleAlbumField('appleImported', true);
                        handleAlbumField('appleTrackTitle', t.name || '');
                        const previewUrl = Array.isArray(t.previews) && t.previews[0] ? t.previews[0].url : '';
                        handleAlbumField('appleTrackPreview', previewUrl || '');
                        // Manteniamo il link nel campo; il pulsante verrà creato/aggiornato al Salva
                        // Cover da artwork
                        if (!albumForm.cover && t.artwork && t.artwork.url) {
                          const art = t.artwork.url.replace('{w}x{h}', '600x600');
                          handleAlbumField('cover', art);
                        }
                        // Aggiungi preview a tracks se presente
                        if (previewUrl) {
                          const exists = (albumForm.tracks||[]).some(x => x.link === previewUrl);
                          if (!exists) {
                            setAlbumForm(prev => ({ ...prev, tracks: [...(prev.tracks||[]), { title: t.name || 'Preview', link: previewUrl }] }));
                          }
                          // Scrivi anche su subcollection per player sito
                          try {
                            if (artist && artist.id) {
                              const trackId = `ap_${t.id}`;
                              await fsSetDoc(fsDoc(db, 'artisti', artist.id, 'tracks', trackId), {
                                title: t.name || 'Apple Preview',
                                previewAudioUrl: previewUrl,
                                fullAudioUrl: '',
                                downloadLink: '',
                                paymentLinkUrl: '',
                                source: 'apple',
                                createdAt: fsServerTimestamp()
                              }, { merge: true });
                            }
                          } catch (w) {
                            console.warn('Scrittura subcollection tracce Apple fallita (non bloccante)', w?.message || w);
                          }
                        }
                      } catch (err) {
                        console.error('Errore import Apple track', err);
                        const msg = String(err?.message || err || '');
                        // Fallback senza API: salva link e prova preview/titolo via iTunes Search
                        if (/apple|musickit|non configurato|privatekey|teamid|keyid/i.test(msg)) {
                          try {
                            const rawUrl = raw;
                            handleAlbumField('appleTrackUrl', rawUrl);
                            // Prova ad estrarre l'ID della traccia (?i=123456789) o ultimo segmento numerico
                            let id = (rawUrl.match(/[?&]i=(\d{5,})/) || [])[1];
                            if (!id) {
                              const m = rawUrl.match(/\/(\d{5,})(?:[/?#].*|$)/);
                              if (m) id = m[1];
                            }
                            if (id) {
                              try {
                                const r = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
                                if (r.ok) {
                                  const j = await r.json();
                                  if (j?.resultCount > 0) {
                                    const it = j.results[0];
                                    if (it?.trackName) handleAlbumField('appleTrackTitle', it.trackName);
                                    if (it?.previewUrl) handleAlbumField('appleTrackPreview', it.previewUrl);
                                  }
                                }
                              } catch {}
                            }
                            alert('Link Apple salvato nel riquadro. Metadati limitati perché Apple Music non è configurato. Premi Salva per aggiornare i pulsanti.');
                          } catch (e2) {
                            alert('Apple Music non configurato. Ho lasciato il link nel campo.');
                          }
                        } else {
                          alert('Errore importazione traccia: ' + msg);
                        }
                      }
                    }}
                    style={{ background:'#fff', color:'#000', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, cursor:'pointer', boxShadow:'0 0 10px rgba(255,255,255,0.25)', fontSize:13 }}
                  >Importa Metadati</button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      handleAlbumField('appleTrackUrl','');
                      handleAlbumField('appleImported', false);
                      handleAlbumField('appleTrackPreview','');
                      handleAlbumField('appleTrackTitle','');
                    }}
                    style={{ background:'#222', color:'#ddd', border:'1px solid #666', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                  >Reset</button>
                  {albumForm.appleTrackPreview && (
                    <button
                      type="button"
                      onClick={() => window.open(albumForm.appleTrackPreview,'_blank','noopener,noreferrer')}
                      style={{ background:'#111', color:'#ddd', border:'1px solid #666', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                    >Anteprima</button>
                  )}
                </div>
                {albumForm.appleImported ? (
                  <div style={{ background:'#121212', border:'1px solid #555', borderRadius:8, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6 }}>
                    <div style={{ fontSize:13, color:'#fff', fontWeight:600 }}>Metadati importati</div>
                    <div style={{ fontSize:12, color:'#ddd' }}>Titolo: {albumForm.appleTrackTitle || '—'}</div>
                    <div style={{ fontSize:12, color:'#ddd' }}>Preview URL: {albumForm.appleTrackPreview ? <a href={albumForm.appleTrackPreview} target="_blank" rel="noreferrer" style={{ color:'#fff', textDecoration:'underline' }}>Apri</a> : 'non disponibile'}</div>
                    <div style={{ fontSize:11, color:'#aaa' }}>Salva per rendere permanenti i metadati e la copertina.</div>
                  </div>
                ) : (
                  <div style={{ fontSize:11, color:'#888' }}>Incolla l'URL della traccia Apple Music e premi "Importa Metadati" per riempire titolo, anteprima e copertina (se mancante).</div>
                )}
              </div>
            </div>
            {/* Riquadro collegamento traccia YouTube */}
            <div style={{ width:'100%', maxWidth:520, marginTop:16, background:'#101010', border:'1px solid #333', borderRadius:12, padding:14, boxShadow:'0 0 10px rgba(0,0,0,0.3)' }}>
              <h5 style={{ margin:'0 0 10px', color:'#ff4444', fontSize:16, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:26, height:26, display:'inline-flex', alignItems:'center', justifyContent:'center', background:'#ff0000', color:'#fff', borderRadius:6, fontSize:14, fontWeight:700 }}>Y</span>
                Traccia YouTube → Link diretto
              </h5>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <input
                  type="text"
                  value={albumForm.youtubeTrackUrl || ''}
                  onChange={e => handleAlbumField('youtubeTrackUrl', e.target.value)}
                  placeholder="Incolla URL YouTube del brano (https://youtu.be/... oppure https://www.youtube.com/watch?v=...)"
                  style={{ width:'100%', background:'#0b0b0b', color:'#ffaaaa', border:'1px solid #552222', borderRadius:8, padding:'8px 10px', fontSize:13 }}
                />
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  
                  <button
                    type="button"
                    onClick={() => handleAlbumField('youtubeTrackUrl','')}
                    style={{ background:'#222', color:'#ff8888', border:'1px solid #552222', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                  >Reset</button>
                  {albumForm.youtubeTrackUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(albumForm.youtubeTrackUrl,'_blank','noopener,noreferrer')}
                      style={{ background:'#111', color:'#ffaaaa', border:'1px solid #552222', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer', fontSize:13 }}
                    >Apri</button>
                  )}
                </div>
                <div style={{ fontSize:11, color:'#888' }}>Questo campo non importa metadati: serve a mostrare il pulsante YouTube e verificare a colpo d'occhio il link in dashboard.</div>
              </div>
            </div>
            </>
            )}
            {/* Barra di stato per upload audio del pulsante Play */}
            {audioUploadingIdx !== null && (
              <div style={{ width: 280, marginTop: 6 }}>
                <div style={{ color: '#bbb', fontSize: 12, marginBottom: 4 }}>Caricamento audio: {audioUploadPct}%</div>
                <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', border: '1px solid #444' }}>
                  <div style={{ width: `${audioUploadPct}%`, height: '100%', background: '#ffd700', transition: 'width 0.2s' }} />
                </div>
              </div>
            )}
            {/* Bottoni social + Play singolo (opzionale) */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 8 }}>
              {albumForm.buttons.map((btn, idx) => (
                <div key={btn.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", boxShadow: "0 0 6px #ffd700", background: "#222", padding: 3, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={btn.name} size={26} />
                  </div>
                  <input
                    type="text"
                    value={btn.link}
                    onChange={e => handleAlbumButtonLink(idx, e.target.value)}
                    placeholder={`Link ${btn.name}`}
                    style={{ width: 110, fontSize: "0.95em", background: "#111", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, textAlign: "center" }}
                  />
                  {btn.name === 'Play' && (
                    <button
                      onClick={() => selectAlbumAudio(idx)}
                      disabled={audioUploadingIdx !== null}
                      title="Carica traccia audio"
                      style={{ marginTop: 6, background: audioUploadingIdx !== null ? '#555' : '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: audioUploadingIdx !== null ? 'not-allowed' : 'pointer' }}
                    >
                      {audioUploadingIdx === idx ? `Upload ${audioUploadPct}%` : 'Carica audio'}
                    </button>
                  )}
                  <span style={{ color: "#ffd700", fontSize: "0.95em", marginTop: 2 }}>{btn.name}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems:'center', flexWrap:'wrap' }}>
              <button style={{ padding: "8px 20px", background: "#ffd700", color: "#222", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }} onClick={handleSaveAlbum}>{editingIdx !== null ? "Salva Modifiche" : "Aggiungi"}</button>
              {/* Pulsante Salva rapido vicino ai picker, con feedback visivo */}
              <QuickSaveAlbum onSave={handleSaveAlbum} />
              {editingIdx !== null && (
                <button style={{ padding: "8px 20px", background: "#222", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }} onClick={() => { setEditingIdx(null); setAlbumForm(emptyAlbum); }}>Annulla</button>
              )}
            </div>
          </div>
    </div>
  </div>
  )}

      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 32 }}>
        {onCancel && (
          <button
            style={{ padding: "10px 24px", background: "#222", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }}
            onClick={onCancel}
          >
            Annulla
          </button>
        )}
        {/* Pulsante Salva sotto */}
        {onSave && (
          <button
            style={{ padding: "10px 32px", background: "#ffd700", color: "#222", border: "none", borderRadius: 8, fontWeight: "bold", fontSize: "1.2em", cursor: "pointer" }}
            onClick={saveAll}
          >
            {saving ? (progress.phase ? `Salvataggio... ${progress.done}/${progress.total}` : 'Salvataggio...') : 'Salva'}
          </button>
        )}
      </div>
      {errorSave && (
        <div style={{ marginTop: 16, color: '#ff4d4f', fontWeight: 'bold' }}>Errore: {errorSave}</div>
      )}
      {saving && (
        <div style={{ marginTop: 12, color: '#ffd700', fontSize: '0.9em' }}>
          Fase: {progress.phase || 'Salvataggio dati'}{progress.total > 0 ? ` (${progress.done}/${progress.total})` : ''}
          {progress.total > 0 ? (
            <div style={{ width: 240, height: 8, background: '#333', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', background: '#ffd700', transition: 'width 0.3s' }} />
            </div>
          ) : (
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffd700', boxShadow: '0 0 8px #ffd700', animation: 'pulse 1s infinite ease-in-out' }} />
              <span>Salvataggio in corso…</span>
            </div>
          )}
          {savingItems.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {savingItems.map(it => (
                <div key={it.key} style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: '#bbb' }}>{it.label}</div>
                  <div style={{ width: 240, height: 6, background: '#222', borderRadius: 4, overflow: 'hidden', border: '1px solid #444' }}>
                    <div style={{ width: `${itemProgress[it.key] || 0}%`, height: '100%', background: '#ffd700', transition: 'width 0.2s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default ArtistPageEditable;

// Mini componente per salvataggio rapido con feedback locale
function QuickSaveAlbum({ onSave }) {
  const [stato, setStato] = React.useState('idle'); // idle | saving | done | err
  const [timer, setTimer] = React.useState(null);
  React.useEffect(() => () => { if (timer) clearTimeout(timer); }, [timer]);
  async function handleClick() {
    if (!onSave || stato === 'saving') return;
    try {
      setStato('saving');
      await onSave();
      setStato('done');
      const t = setTimeout(() => setStato('idle'), 1800);
      setTimer(t);
    } catch (e) {
      console.warn('QuickSaveAlbum error', e);
      setStato('err');
      const t = setTimeout(() => setStato('idle'), 2500);
      setTimer(t);
    }
  }
  let label = 'Salva rapido';
  if (stato === 'saving') label = 'Salvataggio…';
  else if (stato === 'done') label = 'Salvato ✓';
  else if (stato === 'err') label = 'Errore';
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={stato === 'saving'}
      style={{
        background: stato === 'done' ? '#1DB954' : (stato === 'err' ? '#5d1818' : '#222'),
        color: stato === 'done' ? '#000' : (stato === 'err' ? '#ffb3b3' : '#ffd700'),
        border: '1px solid ' + (stato === 'done' ? '#1DB954' : (stato === 'err' ? '#aa2b2b' : '#555')),
        borderRadius: 6,
        padding: '8px 14px',
        fontWeight: 600,
        cursor: stato === 'saving' ? 'not-allowed' : 'pointer',
        fontSize: 13,
        boxShadow: stato === 'done' ? '0 0 10px rgba(29,185,84,0.6)' : 'none',
        transition: 'background .3s, color .3s'
      }}
    >{label}</button>
  );
}
