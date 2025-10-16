import React, { useEffect, useState } from "react";
import { db, storage } from "./firebase";
import { collection, doc, onSnapshot, setDoc, addDoc, serverTimestamp, getDocs, writeBatch, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function DashboardTracks() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [uploadingAudio, setUploadingAudio] = useState({});
  const [audioPct, setAudioPct] = useState({});
  const [uploadingZip, setUploadingZip] = useState({});
  const [zipPct, setZipPct] = useState({});
  const [uploadingPreview, setUploadingPreview] = useState({});
  const [previewPct, setPreviewPct] = useState({});
  const [creating, setCreating] = useState(false);
  const [dragFull, setDragFull] = useState({});
  const [dragPreview, setDragPreview] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null); // {inserted, skipped}

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'musicaTracks'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b) => {
        const am = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds*1000 : Number.MAX_SAFE_INTEGER);
        const bm = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds*1000 : Number.MAX_SAFE_INTEGER);
        if (am !== bm) return am - bm;
        return (a.title||'').localeCompare(b.title||'');
      });
      setTracks(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const changeField = (track, field, value) => {
    setEditing(prev => ({ ...prev, [track.id]: { ...(prev[track.id]||{}), [field]: value } }));
  };

  const saveTrack = async (track) => {
    try {
      const d = editing[track.id] || {};
      let priceVal = null;
      if (d.price !== undefined && d.price !== null && d.price !== '') {
        const parsed = parseFloat(String(d.price).replace(',', '.'));
        priceVal = Number.isFinite(parsed) ? parsed : null;
      }
      await setDoc(doc(db, 'musicaTracks', track.id), {
        title: d.title !== undefined ? d.title : track.title,
        paymentLinkUrl: (d.paymentLinkUrl ?? track.paymentLinkUrl ?? '').trim(),
        downloadLink: (d.downloadLink ?? track.downloadLink ?? '').trim(),
        price: priceVal,
        sold: d.sold !== undefined ? !!d.sold : !!track.sold
      }, { merge: true });
      alert('Salvato');
    } catch (e) {
      console.error('Errore salvataggio', e);
      alert('Errore salvataggio');
    }
  };

  const uploadAudio = async (track, file) => {
    if (!file) return;
    try {
      setUploadingAudio(p => ({ ...p, [track.id]: true }));
  const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `musica/audio/${track.id}_${Date.now()}_${safe}`);
      try {
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(r, file);
          let last=0;
          task.on('state_changed', (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (pct !== last) { last=pct; setAudioPct(p => ({ ...p, [track.id]: pct })); }
          }, (err) => reject(err), () => resolve());
        });
      } catch (e) {
        console.warn('[DashboardTracks] resumable audio fallito, uso simple', e?.message || e);
        await uploadBytes(r, file);
        setAudioPct(p => ({ ...p, [track.id]: 100 }));
      }
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'musicaTracks', track.id), { audioUrl: url }, { merge: true });
    } catch (e) {
      console.error('Errore upload audio', e);
      alert('Errore upload audio');
    } finally {
      setUploadingAudio(p => ({ ...p, [track.id]: false }));
    }
  };

  const uploadPreview = async (track, file) => {
    if (!file) return;
    try {
      setUploadingPreview(p => ({ ...p, [track.id]: true }));
  const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `musica/previews/${track.id}_${Date.now()}_${safe}`);
      try {
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(r, file);
          let last=0;
          task.on('state_changed', (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (pct !== last) { last=pct; setPreviewPct(p => ({ ...p, [track.id]: pct })); }
          }, (err) => reject(err), () => resolve());
        });
      } catch (e) {
        console.warn('[DashboardTracks] resumable preview fallito, uso simple', e?.message || e);
        await uploadBytes(r, file);
        setPreviewPct(p => ({ ...p, [track.id]: 100 }));
      }
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'musicaTracks', track.id), { previewAudioUrl: url }, { merge: true });
    } catch (e) {
      console.error('Errore upload preview', e);
      alert('Errore upload preview');
    } finally {
      setUploadingPreview(p => ({ ...p, [track.id]: false }));
    }
  };

  const createTrack = async () => {
    const title = prompt('Titolo nuova traccia:');
    if (!title) return;
    try {
      setCreating(true);
      await addDoc(collection(db, 'musicaTracks'), {
        title: title.trim(),
        paymentLinkUrl: '',
        downloadLink: '',
        audioUrl: '', // full legacy
        fullAudioUrl: '',
        previewAudioUrl: '',
        price: 1.99,
        sold: false,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Errore creazione traccia', e);
      alert('Errore creazione traccia');
    } finally {
      setCreating(false);
    }
  };

  // Normalizza stringa per ricavare una chiave sorgente stabile
  const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g,' ').replace(/[^a-z0-9 _-]/g,'').replace(/\s/g,'_');

  const buildSourceKey = (artistId, albumTitle, trackTitle) => `art:${norm(artistId)}::alb:${norm(albumTitle)}::trk:${norm(trackTitle)}`;

  const canonicalUrl = (u) => {
    if (!u) return '';
    try {
      const noHash = u.split('#')[0];
      const base = noHash.split('?')[0]; // rimuove query token firmati per dedup
      return base.trim();
    } catch { return u.trim(); }
  };

  const importFromArtists = async () => {
    if (importing) return;
    try {
      setImporting(true);
      setImportResult(null);
      // Carica esistenti per evitare duplicati: useremo sourceKey e anche url
      const existingSnap = await getDocs(collection(db, 'musicaTracks'));
      const existing = existingSnap.docs.map(d => ({ id:d.id, ...d.data() }));
      const existingKeys = new Set();
      const existingUrls = new Set();
      existing.forEach(t => {
        if (t.sourceKey) existingKeys.add(t.sourceKey);
        const eu = canonicalUrl(t.fullAudioUrl || t.audioUrl || '');
        if (eu) existingUrls.add(eu);
      });
      const artistsSnap = await getDocs(collection(db, 'artisti'));
      let inserted = 0, skipped = 0;
      const batchCandidates = [];
      const STRIPE_SINGLE_1_99 = 'https://pay.arteregistrazioni.com/b/5kQ4gzaeLae2gPJ3bw7EQ02';
      const updateBatch = writeBatch(db); // per aggiungere sourceKey/payment a tracce esistenti
      let updates = 0;
      for (const adoc of artistsSnap.docs) {
        const artistData = adoc.data() || {};
        const artistName = artistData.nome || artistData.name || '';
        const albums = Array.isArray(artistData.albums) ? artistData.albums : [];
        for (const album of albums) {
          const albumTitle = album.title || 'album';
          const tracksArr = Array.isArray(album.tracks) ? album.tracks : [];
          for (const t of tracksArr) {
            if (!(t && t.link)) { skipped++; continue; }
            const sk = buildSourceKey(adoc.id, albumTitle, t.title || 'track');
            const cu = canonicalUrl(t.link);
            // Se esiste già per URL ma manca sourceKey/payment: aggiorno
            if (existingUrls.has(cu)) {
              // trova doc corrispondente per possibile arricchimento
              const found = existing.find(ex => canonicalUrl(ex.fullAudioUrl || ex.audioUrl || '') === cu);
              if (found && (!found.sourceKey || !found.paymentLinkUrl || !found.downloadLink || !found.price)) {
                updateBatch.set(doc(db, 'musicaTracks', found.id), {
                  sourceKey: found.sourceKey || sk,
                  paymentLinkUrl: found.paymentLinkUrl || STRIPE_SINGLE_1_99,
                  downloadLink: found.downloadLink || (found.fullAudioUrl || found.audioUrl || ''),
                  price: found.price || 1.99
                }, { merge: true });
                updates++;
              }
              skipped++; continue;
            }
            if (existingKeys.has(sk)) { skipped++; continue; }
            batchCandidates.push({
              title: t.title || 'Senza titolo',
              artist: artistName,
              genre: album.genre || '',
              fullAudioUrl: t.link,
              previewAudioUrl: '',
              paymentLinkUrl: STRIPE_SINGLE_1_99,
              paypalLinkUrl: '',
              // Uso il file stesso come download iniziale (si può poi sostituire con ZIP)
              downloadLink: t.link,
              price: 1.99,
              sold: false,
              sourceKey: sk,
              artistId: adoc.id,
              albumTitle: albumTitle,
              createdAt: serverTimestamp()
            });
            // Aggiorno insiemi per evitare duplicati nella stessa sessione
            existingKeys.add(sk);
            existingUrls.add(cu);
          }
        }
        // Supporto eventuale struttura diretta artistData.tracks (singoli fuori da albums)
        if (Array.isArray(artistData.tracks)) {
          for (const t of artistData.tracks) {
            if (!(t && t.link)) { skipped++; continue; }
            const sk = buildSourceKey(adoc.id, 'singoli', t.title || 'track');
            const cu = canonicalUrl(t.link);
            if (existingUrls.has(cu)) {
              const found = existing.find(ex => canonicalUrl(ex.fullAudioUrl || ex.audioUrl || '') === cu);
              if (found && (!found.sourceKey || !found.paymentLinkUrl || !found.downloadLink || !found.price)) {
                updateBatch.set(doc(db, 'musicaTracks', found.id), {
                  sourceKey: found.sourceKey || sk,
                  paymentLinkUrl: found.paymentLinkUrl || STRIPE_SINGLE_1_99,
                  downloadLink: found.downloadLink || (found.fullAudioUrl || found.audioUrl || ''),
                  price: found.price || 1.99
                }, { merge: true });
                updates++;
              }
              skipped++; continue;
            }
            if (existingKeys.has(sk)) { skipped++; continue; }
            batchCandidates.push({
              title: t.title || 'Senza titolo',
              artist: artistName,
              genre: t.genre || '',
              fullAudioUrl: t.link,
              previewAudioUrl: '',
              paymentLinkUrl: STRIPE_SINGLE_1_99,
              paypalLinkUrl: '',
              downloadLink: t.link,
              price: 1.99,
              sold: false,
              sourceKey: sk,
              artistId: adoc.id,
              albumTitle: 'singoli',
              createdAt: serverTimestamp()
            });
            existingKeys.add(sk);
            existingUrls.add(cu);
          }
        }
      }
      if (updates > 0) await updateBatch.commit();
      // Inserimento batched per efficienza (max 450 per batch per sicurezza)
      let batch = writeBatch(db);
      let ops = 0;
      for (const cand of batchCandidates) {
        const refDoc = doc(collection(db, 'musicaTracks'));
        batch.set(refDoc, cand);
        inserted++;
        ops++;
        if (ops >= 450) { await batch.commit(); batch = writeBatch(db); ops = 0; }
      }
      if (ops > 0) await batch.commit();
      setImportResult({ inserted, skipped });
    } catch (e) {
      console.error('Errore importazione', e);
      setImportResult({ inserted:0, skipped:0, error: e.message || 'Errore' });
    } finally {
      setImporting(false);
    }
  };

  const deleteTrack = async (track) => {
    if (!window.confirm(`Eliminare definitivamente il brano "${track.title || 'senza titolo'}"?`)) return;
    try {
      await deleteDoc(doc(db, 'musicaTracks', track.id));
    } catch (e) {
      console.error('Errore eliminazione', e);
      alert('Errore eliminazione');
    }
  };

  const uploadZip = async (track, file) => {
    if (!file) return;
    try {
      setUploadingZip(p => ({ ...p, [track.id]: true }));
  const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `musica/zips/${track.id}_${Date.now()}_${safe}`);
      try {
        await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(r, file);
          let last=0;
          task.on('state_changed', (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            if (pct !== last) { last=pct; setZipPct(p => ({ ...p, [track.id]: pct })); }
          }, (err) => reject(err), () => resolve());
        });
      } catch (e) {
        console.warn('[DashboardTracks] resumable zip fallito, uso simple', e?.message || e);
        await uploadBytes(r, file);
        setZipPct(p => ({ ...p, [track.id]: 100 }));
      }
      const url = await getDownloadURL(r);
      setEditing(prev => ({ ...prev, [track.id]: { ...(prev[track.id]||{}), downloadLink: url } }));
      await setDoc(doc(db, 'musicaTracks', track.id), { downloadLink: url }, { merge: true });
    } catch (e) {
      console.error('Errore upload ZIP', e);
      alert('Errore upload ZIP');
    } finally {
      setUploadingZip(p => ({ ...p, [track.id]: false }));
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "32px auto", padding: "0 12px" }}>
      <h2 style={{ color: '#ffd700', marginBottom: 16, fontSize:'1.9rem' }}>Gestione Tracce Musica</h2>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:24 }}>
        <button onClick={createTrack} disabled={creating} style={{ background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:700, cursor: creating? 'default':'pointer', boxShadow:'0 0 8px #ffd700' }}>{creating ? 'Creazione…' : 'Nuova Traccia'}</button>
        <button onClick={importFromArtists} disabled={importing} style={{ background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'10px 16px', fontWeight:600, cursor: importing? 'default':'pointer' }}>{importing ? 'Importazione…' : 'Importa da Artisti'}</button>
        {importResult && (
          <span style={{ color: importResult.error ? '#ff6b6b' : '#8aff8a', fontSize:14, fontWeight:600 }}>
            {importResult.error ? `Errore: ${importResult.error}` : `Import: +${importResult.inserted} (skip ${importResult.skipped})`}
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ color: "#ffd700", textAlign: "center", marginTop: 24 }}>Caricamento…</div>
      ) : tracks.length === 0 ? (
        <div style={{ color: "#ffd700", textAlign: "center", marginTop: 24 }}>Nessun brano disponibile.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {tracks.map(track => {
            const edit = editing[track.id] || {};
            return (
              <div key={track.id} style={{ background:'#181818', borderRadius:12, padding:18, boxShadow:'0 0 12px #ffd700', display:'grid', gridTemplateColumns:'1.15fr 1fr 1fr 0.65fr 1fr 1fr 1fr 0.75fr 130px 70px', gap:12, alignItems:'center' }}>
                <input type="text" value={edit.title ?? track.title ?? ''} onChange={e => changeField(track, 'title', e.target.value)} placeholder="Titolo" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                <div style={{ display:'flex', flexDirection:'column', gap:4 }} title="Full / Streaming">
                  <input id={`audio_full_${track.id}`} type="file" accept="audio/*" style={{ display:'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadAudio(track, f); e.target.value=''; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragFull(p => ({ ...p, [track.id]: true })); }}
                    onDragLeave={() => setDragFull(p => ({ ...p, [track.id]: false }))}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files && e.dataTransfer.files[0]; setDragFull(p => ({ ...p, [track.id]: false })); if (file) uploadAudio(track, file); }}
                    style={{ border: dragFull[track.id] ? '2px dashed #ffd700' : '2px dashed #333', borderRadius:8, padding:4, display:'flex', flexDirection:'column', alignItems:'stretch', gap:4 }}
                  >
                    <button type="button" onClick={() => document.getElementById(`audio_full_${track.id}`).click()} style={{ background: uploadingAudio[track.id]?'#444':'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'6px 8px', cursor: uploadingAudio[track.id]?'default':'pointer', fontWeight:600, fontSize:12 }}>
                      {uploadingAudio[track.id] ? `Full… ${audioPct[track.id] ?? 0}%` : 'Full'}
                    </button>
                    <span style={{ textAlign:'center', fontSize:10, color:'#888' }}>Drag & Drop</span>
                  </div>
                  {(track.fullAudioUrl || track.audioUrl) ? <a href={(track.fullAudioUrl||track.audioUrl)} target="_blank" rel="noreferrer" style={{ color:'#ffd700', fontSize:12 }}>Apri</a> : <span style={{ color:'#777', fontSize:12 }}>manca</span>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }} title="Preview 15s">
                  <input id={`audio_prev_${track.id}`} type="file" accept="audio/*" style={{ display:'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadPreview(track, f); e.target.value=''; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragPreview(p => ({ ...p, [track.id]: true })); }}
                    onDragLeave={() => setDragPreview(p => ({ ...p, [track.id]: false }))}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files && e.dataTransfer.files[0]; setDragPreview(p => ({ ...p, [track.id]: false })); if (file) uploadPreview(track, file); }}
                    style={{ border: dragPreview[track.id] ? '2px dashed #ffd700' : '2px dashed #333', borderRadius:8, padding:4, display:'flex', flexDirection:'column', alignItems:'stretch', gap:4 }}
                  >
                    <button type="button" onClick={() => document.getElementById(`audio_prev_${track.id}`).click()} style={{ background: uploadingPreview[track.id]?'#444':'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'6px 8px', cursor: uploadingPreview[track.id]?'default':'pointer', fontWeight:600, fontSize:12 }}>
                      {uploadingPreview[track.id] ? `Prev… ${previewPct[track.id] ?? 0}%` : 'Preview'}
                    </button>
                    <span style={{ textAlign:'center', fontSize:10, color:'#888' }}>Drag & Drop</span>
                  </div>
                  {track.previewAudioUrl ? <a href={track.previewAudioUrl} target="_blank" rel="noreferrer" style={{ color:'#ffd700', fontSize:12 }}>Apri</a> : <span style={{ color:'#777', fontSize:12 }}>manca</span>}
                </div>
                <input type="text" value={edit.price ?? (track.price ?? '')} onChange={e => changeField(track,'price', e.target.value)} placeholder="Prezzo" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                <input type="url" value={edit.paymentLinkUrl ?? (track.paymentLinkUrl || '')} onChange={e => changeField(track,'paymentLinkUrl', e.target.value)} placeholder="Stripe Link" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                {/* Campo PayPal rimosso */}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <input type="url" value={edit.downloadLink ?? (track.downloadLink || '')} onChange={e => changeField(track,'downloadLink', e.target.value)} placeholder="Download ZIP" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                  <input id={`zip_${track.id}`} type="file" accept=".zip,application/zip" style={{ display:'none' }} onChange={e => { const f=e.target.files&&e.target.files[0]; if (f) uploadZip(track,f); e.target.value=''; }} />
                  <button onClick={() => document.getElementById(`zip_${track.id}`).click()} style={{ background: uploadingZip[track.id]?'#444':'#222', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'6px 10px', cursor: uploadingZip[track.id]?'default':'pointer', fontWeight:600 }}>{uploadingZip[track.id]?`ZIP… ${zipPct[track.id] ?? 0}%`:'ZIP'}</button>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:6, color:'#ddd', fontSize:12 }}>
                  <input type="checkbox" checked={!!(edit.sold ?? track.sold)} onChange={e => changeField(track,'sold', e.target.checked)} />
                  Venduto
                </label>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={() => saveTrack(track)} style={{ background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'6px 12px', fontWeight:700, cursor:'pointer' }}>Salva</button>
                  {(edit.paymentLinkUrl || track.paymentLinkUrl) && (
                    <button onClick={() => { const link = edit.paymentLinkUrl || track.paymentLinkUrl; if (link) window.open(link,'_blank','noopener,noreferrer'); }} style={{ background:'#333', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'6px 12px', fontWeight:600, cursor:'pointer' }}>Test</button>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'stretch' }}>
                  <button onClick={() => deleteTrack(track)} style={{ background:'#3b0f0f', color:'#ff9393', border:'1px solid #aa2b2b', borderRadius:8, padding:'6px 10px', fontWeight:600, cursor:'pointer' }}>Elimina</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
