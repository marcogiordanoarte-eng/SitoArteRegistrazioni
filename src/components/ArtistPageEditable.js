import React, { useState, useRef } from "react";
import "./Artisti.css";
// Reintroduciamo solo l'upload verso Firebase Storage al momento del salvataggio
import { storage, functions, auth } from "./firebase";
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

function ArtistPageEditable({ artist = {}, onSave, onCancel }) {
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
    buttons: defaultButtons.map(b => ({ ...b })),
    videoUrl: "",
    downloadLink: "",
    paymentLinkUrl: "",
    tracks: []
  };
  // State for album form editing and uploads
  const [editingIdx, setEditingIdx] = useState(null);
  const [albumForm, setAlbumForm] = useState(emptyAlbum);
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
    if (editingIdx !== null) {
      setAlbums(albums.map((a, i) => i === editingIdx ? albumForm : a));
    } else {
      setAlbums([...albums, albumForm]);
    }
    setAlbumForm(emptyAlbum);
    setEditingIdx(null);
  }

  // Handler per modifica album
  function handleEditAlbum(idx) {
    setEditingIdx(idx);
    setAlbumForm(albums[idx]);
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
  // Selettore ZIP con upload diretto (usa File crudo, non dataURL)
  function selectAlbumZip() {
    if (zipUploading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/zip,.zip';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      uploadAlbumZip(file);
    };
    input.click();
  }

  // slugify helper moved to module scope

  async function uploadAlbumZip(file) {
    try {
      const MAX_ZIP = 500 * 1024 * 1024; // 500MB
      if (file.size > MAX_ZIP) {
        alert(`ZIP troppo grande: ${(file.size/1024/1024).toFixed(1)}MB. Limite ~${(MAX_ZIP/1024/1024)}MB.`);
        return;
      }
  setZipUploading(true);
  setZipUploadPct(0);
      const artistSlug = slugify(name);
      const albumSlug = slugify(albumForm.title || 'album');
  const storagePath = `album-zips/${artistSlug}/${albumSlug}_${Date.now()}.zip`;
  const storageRef = ref(storage, storagePath);
      const metadata = { contentType: file.type || 'application/zip' };
  await uploadWithFallback(storageRef, storagePath, file, metadata, (pct) => setZipUploadPct(pct));
      const url = await getDownloadURL(storageRef);
      setAlbumForm(prev => ({ ...prev, downloadLink: url }));
    } catch (err) {
      console.error('Errore upload ZIP', err);
      alert('Errore upload ZIP: ' + (err && err.message ? err.message : err));
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

  

  // Caricamento resiliente: prova resumable (con timeout+retry), poi semplice (raw) con retry (senza metadata) se fallisce o se forzato da env
  async function uploadWithFallback(storageRef, storagePath, data, metadata, onProgress, options = {}) {
    // Keep options for future tuning; not used directly to avoid lint noise
    const { timeoutMs = 120000, retries = 2, backoffBaseMs = 1000 } = options; // eslint-disable-line no-unused-vars

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

    // 0) Prova prima Signed POST Policy (nessun preflight) se autenticati
    try {
      if (useSignedPost && auth && auth.currentUser) {
        await uploadWithSignedPost(storagePath, data, (metadata && metadata.contentType) || (data && data.type), onProgress);
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
        throw e;
      }
    }
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
    form.append('file', data);
    const resp = await fetch(url, { method: 'POST', body: form });
    if (!(resp.status === 204 || resp.status === 201 || resp.ok)) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Signed POST fallita: ${resp.status} ${txt}`);
    }
    onProgress && onProgress(100);
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
      // Determina se l'album in compilazione contiene dati significativi
      const hasAlbumDraft = () => {
        const a = albumForm || {};
        const hasCover = !!a.cover;
        const hasMeta = (a.title && a.title.trim()) || (a.year && String(a.year).trim()) || (a.genre && a.genre.trim());
        const hasLinks = (a.downloadLink && a.downloadLink.trim()) || (a.paymentLinkUrl && a.paymentLinkUrl.trim()) || (a.paypalHostedButtonId && a.paypalHostedButtonId.trim()) || (a.videoUrl && a.videoUrl.trim());
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

      {/* Steps images upload */}
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

      {/* Album/cover/disco management */}
      <div style={{ width: "100%", maxWidth: 700, margin: "0 auto 32px auto" }}>
        <h3 style={{ color: "#ffd700", textAlign: "center", marginBottom: 16 }}>Dischi / Cover</h3>
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
                    <div style={{ display: "flex", gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {album.buttons.map((btn, bidx) => {
                        const k = btn && btn.name ? btn.name : `btn_${bidx}`;
                        return (
                          <span key={k} style={{ display: "inline-flex", alignItems: 'center' }}>
                            {btn.name === "Buy & Download"
                              ? (
                                btn.link
                                  ? (
                                    <a href={btn.link} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#222', color: '#ffd700', border: '1px solid #555', borderRadius: 6, padding: '4px 8px', fontSize: 12, textDecoration: 'none' }}>
                                      <Icon name="Download" size={14} />
                                      <span>Download</span>
                                    </a>
                                  )
                                  : (
                                    <form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_top" style={{ display: "inline-block" }}>
                                      <input type="hidden" name="cmd" value="_s-xclick" />
                                      <input type="hidden" name="hosted_button_id" value="5CGE5SB2DM2G2" />
                                      <input type="hidden" name="currency_code" value="EUR" />
                                      <button type="submit" title="Paga con PayPal" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ffd700', color: '#222', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                                        <Icon name="Download" size={14} />
                                        Download
                                      </button>
                                    </form>
                                  )
                              )
                              : (
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
                    </div>
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
            {/* Link ZIP album privato, usato da /download-confirm + Upload diretto */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <input
                type="text"
                value={albumForm.downloadLink}
                onChange={e => handleAlbumField("downloadLink", e.target.value)}
                placeholder="Link ZIP Album (privato)"
                style={{ width: 280, fontSize: "1.0em", background: "#111", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, textAlign: "center" }}
              />
              <button
                onClick={() => selectAlbumZip()}
                disabled={zipUploading}
                style={{ background: zipUploading ? '#555' : '#222', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, padding: '6px 12px', cursor: zipUploading ? 'not-allowed' : 'pointer' }}
              >
                {zipUploading ? `Caricamento ${zipUploadPct}%` : 'Carica ZIP Album'}
              </button>
              <div style={{ color: '#aaa', fontSize: 12, textAlign: 'center' }}>
                Suggerimento: se preferisci, carica manualmente uno ZIP dal tuo computer e incolla qui il link (getDownloadURL) già pronto.
              </div>
            </div>
            {zipUploading && (
              <div style={{ width: 280, marginTop: 6 }}>
                <div style={{ color: '#bbb', fontSize: 12, marginBottom: 4 }}>Caricamento ZIP: {zipUploadPct}%</div>
                <div style={{ width: '100%', height: 8, background: '#333', borderRadius: 4, overflow: 'hidden', border: '1px solid #444' }}>
                  <div style={{ width: `${zipUploadPct}%`, height: '100%', background: '#ffd700', transition: 'width 0.2s' }} />
                </div>
              </div>
            )}
            {/* Pagamenti: Stripe Payment Link (consigliato) oppure PayPal Hosted Button ID (fallback) */}
            <input
              type="text"
              value={albumForm.paymentLinkUrl || ''}
              onChange={e => handleAlbumField('paymentLinkUrl', e.target.value)}
              placeholder="Stripe Payment Link URL"
              style={{ width: 280, fontSize: '1.0em', background: '#111', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, textAlign: 'center', marginBottom: 6 }}
            />
            <input
              type="text"
              value={albumForm.paypalHostedButtonId || ''}
              onChange={e => handleAlbumField('paypalHostedButtonId', e.target.value)}
              placeholder="PayPal Hosted Button ID (opzionale)"
              style={{ width: 280, fontSize: '1.0em', background: '#111', color: '#ffd700', border: '1px solid #ffd700', borderRadius: 6, textAlign: 'center', marginBottom: 8 }}
            />
            {/* Video URL del brano/album (monitor) */}
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
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button style={{ padding: "8px 20px", background: "#ffd700", color: "#222", border: "none", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }} onClick={handleSaveAlbum}>{editingIdx !== null ? "Salva Modifiche" : "Aggiungi"}</button>
              {editingIdx !== null && (
                <button style={{ padding: "8px 20px", background: "#222", color: "#ffd700", border: "1px solid #ffd700", borderRadius: 6, fontWeight: "bold", cursor: "pointer" }} onClick={() => { setEditingIdx(null); setAlbumForm(emptyAlbum); }}>Annulla</button>
              )}
            </div>
          </div>
        </div>
      </div>

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
