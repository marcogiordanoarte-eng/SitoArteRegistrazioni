import React, { useEffect, useState } from 'react';
import { db, storage } from './firebase';
import { collection, doc, onSnapshot, query, addDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/*
 Component: ArtistTracksManager
 Gestione tracce singole per un artista (fuori dagli album principali):
  - Drag & drop / selezione file audio (full) + opzionale ZIP download
  - Creazione doc Firestore in artists/{artistId}/tracks e copia (opzionale) radice globale 'musicaTracks' per uniformità
  - Generazione automatica di URL download (lo stesso file) se ZIP non caricato
  - Campo per Payment Link Stripe (può essere autocompilato da un template base STRIPE_SINGLE_BASE se non impostato)
  - Prezzo default 1.99

 Schema (subcollection artists/{artistId}/tracks/{trackId}):
  {
    title, fullAudioUrl, previewAudioUrl, downloadLink, paymentLinkUrl, price, createdAt
  }
 Opcionalmente duplichiamo / aggiorniamo anche in 'musicaTracks' con campi: artistId, artistName, sourceRef = artists/{artistId}/tracks/{trackId}
*/

const STRIPE_DEFAULT_LINK = 'https://pay.arteregistrazioni.com/b/5kQ4gzaeLae2gPJ3bw7EQ02'; // fallback singolo 1,99

export default function ArtistTracksManager({ artist }) {
  const artistId = artist?.id;
  const [tracks, setTracks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState({});
  const [uploadingFull, setUploadingFull] = useState({});
  const [uploadingZip, setUploadingZip] = useState({});
  const [dragFull, setDragFull] = useState({});
  const [dragZip, setDragZip] = useState({});

  useEffect(() => {
    if (!artistId) return;
    const q = query(collection(db, 'artisti', artistId, 'tracks'));
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a,b) => {
        const am = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds*1000 : Number.MAX_SAFE_INTEGER);
        const bm = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds*1000 : Number.MAX_SAFE_INTEGER);
        if (am !== bm) return am - bm;
        return (a.title||'').localeCompare(b.title||'');
      });
      setTracks(list);
    });
    return () => unsub();
  }, [artistId]);

  const changeField = (t, field, val) => {
    setEditing(prev => ({ ...prev, [t.id]: { ...(prev[t.id]||{}), [field]: val } }));
  };

  const createTrack = async () => {
    const title = prompt('Titolo nuova traccia singola:');
    if (!title) return;
    try {
      setCreating(true);
      await addDoc(collection(db, 'artisti', artistId, 'tracks'), {
        title: title.trim(),
        fullAudioUrl: '',
        previewAudioUrl: '',
        downloadLink: '',
        paymentLinkUrl: STRIPE_DEFAULT_LINK,
        price: 1.99,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Errore creazione traccia artista', e);
      alert('Errore creazione traccia');
    } finally {
      setCreating(false);
    }
  };

  const syncGlobal = async (trackId, data) => {
    try {
      await setDoc(doc(db, 'musicaTracks', `artist_${artistId}_${trackId}`), {
        title: data.title || 'Senza titolo',
        fullAudioUrl: data.fullAudioUrl || '',
        previewAudioUrl: data.previewAudioUrl || '',
        downloadLink: data.downloadLink || (data.fullAudioUrl || ''),
        paymentLinkUrl: data.paymentLinkUrl || STRIPE_DEFAULT_LINK,
        price: data.price ?? 1.99,
        artistId: artistId,
        artist: artist.nome || artist.name || '',
        sourceRef: `artisti/${artistId}/tracks/${trackId}`,
        createdAt: data.createdAt || serverTimestamp(),
        sold: false
      }, { merge: true });
    } catch (e) {
      console.warn('Sync globale musicaTracks fallita', e);
    }
  };

  const saveTrack = async (t) => {
    try {
      const edit = editing[t.id] || {};
      const priceVal = edit.price !== undefined ? parseFloat(String(edit.price).replace(',', '.')) : t.price;
      const payload = {
        title: edit.title !== undefined ? edit.title : t.title,
        paymentLinkUrl: (edit.paymentLinkUrl ?? t.paymentLinkUrl ?? '').trim() || STRIPE_DEFAULT_LINK,
        downloadLink: (edit.downloadLink ?? t.downloadLink ?? '').trim(),
        price: Number.isFinite(priceVal) ? priceVal : 1.99
      };
      await setDoc(doc(db, 'artisti', artistId, 'tracks', t.id), payload, { merge: true });
      await syncGlobal(t.id, { ...t, ...payload });
      alert('Traccia salvata');
    } catch (e) {
      console.error('Errore salvataggio traccia artista', e);
      alert('Errore salvataggio');
    }
  };

  const uploadFull = async (t, file) => {
    if (!file) return;
    try {
      setUploadingFull(p => ({ ...p, [t.id]: true }));
  const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `artists/${artistId}/tracks/${t.id}_${Date.now()}_${safe}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'artisti', artistId, 'tracks', t.id), { fullAudioUrl: url, downloadLink: url }, { merge: true });
      await syncGlobal(t.id, { ...t, fullAudioUrl: url, downloadLink: url });
    } catch (e) {
      console.error('Errore upload audio full', e);
      alert('Errore upload full');
    } finally {
      setUploadingFull(p => ({ ...p, [t.id]: false }));
    }
  };

  const uploadZip = async (t, file) => {
    if (!file) return;
    try {
      setUploadingZip(p => ({ ...p, [t.id]: true }));
  const safe = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `artists/${artistId}/tracks/${t.id}_zip_${Date.now()}_${safe}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'artisti', artistId, 'tracks', t.id), { downloadLink: url }, { merge: true });
      await syncGlobal(t.id, { ...t, downloadLink: url });
    } catch (e) {
      console.error('Errore upload ZIP', e);
      alert('Errore upload ZIP');
    } finally {
      setUploadingZip(p => ({ ...p, [t.id]: false }));
    }
  };

  const deleteTrack = async (t) => {
    if (!window.confirm(`Eliminare la traccia "${t.title || 'senza titolo'}"?`)) return;
    try {
      await deleteDoc(doc(db, 'artisti', artistId, 'tracks', t.id));
      // opzionale: non eliminiamo copia globale per storicità; potresti eliminarla se vuoi
    } catch (e) {
      console.error('Errore eliminazione traccia artista', e);
      alert('Errore eliminazione');
    }
  };

  if (!artistId) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <h4 style={{ color:'#ffd700', marginBottom:12 }}>Tracce Singole Artista</h4>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginBottom:20 }}>
        <button onClick={createTrack} disabled={creating} style={{ background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'8px 14px', fontWeight:700, cursor: creating?'default':'pointer', boxShadow:'0 0 8px #ffd700' }}>{creating ? 'Creazione…' : 'Nuova Traccia'}</button>
        <span style={{ fontSize:12, color:'#999' }}>Drag & drop direttamente sui riquadri Full / ZIP per caricare i file.</span>
      </div>
      {tracks.length === 0 ? (
        <div style={{ color:'#888', fontSize:14 }}>Nessuna traccia singola. Crea la prima.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {tracks.map(t => {
            const edit = editing[t.id] || {};
            return (
              <div key={t.id} style={{ background:'#181818', borderRadius:12, padding:16, display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 120px 70px', gap:12, alignItems:'stretch', boxShadow:'0 0 10px rgba(255,215,0,0.3)' }}>
                <input type="text" value={edit.title ?? t.title ?? ''} onChange={e => changeField(t,'title', e.target.value)} placeholder="Titolo" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <input id={`full_${t.id}`} type="file" accept="audio/*" style={{ display:'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadFull(t,f); e.target.value=''; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragFull(p => ({ ...p, [t.id]: true })); }}
                    onDragLeave={() => setDragFull(p => ({ ...p, [t.id]: false }))}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files && e.dataTransfer.files[0]; setDragFull(p => ({ ...p, [t.id]: false })); if (file) uploadFull(t, file); }}
                    style={{ border: dragFull[t.id] ? '2px dashed #ffd700' : '2px dashed #333', borderRadius:8, padding:6, display:'flex', flexDirection:'column', alignItems:'stretch', gap:4 }}
                  >
                    <button type="button" onClick={() => document.getElementById(`full_${t.id}`).click()} style={{ background: uploadingFull[t.id]?'#444':'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'6px 8px', cursor: uploadingFull[t.id]?'default':'pointer', fontWeight:600, fontSize:12 }}>{uploadingFull[t.id] ? 'Full…' : 'Full'}</button>
                    <span style={{ textAlign:'center', fontSize:10, color:'#888' }}>Drag & Drop</span>
                  </div>
                  {t.fullAudioUrl ? <a href={t.fullAudioUrl} target="_blank" rel="noreferrer" style={{ color:'#ffd700', fontSize:12 }}>Apri</a> : <span style={{ color:'#777', fontSize:12 }}>manca</span>}
                </div>
                <input type="url" value={edit.paymentLinkUrl ?? (t.paymentLinkUrl || '')} onChange={e => changeField(t,'paymentLinkUrl', e.target.value)} placeholder="Stripe Link" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <input id={`zip_${t.id}`} type="file" accept=".zip,application/zip" style={{ display:'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) uploadZip(t,f); e.target.value=''; }} />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragZip(p => ({ ...p, [t.id]: true })); }}
                    onDragLeave={() => setDragZip(p => ({ ...p, [t.id]: false }))}
                    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files && e.dataTransfer.files[0]; setDragZip(p => ({ ...p, [t.id]: false })); if (file) uploadZip(t, file); }}
                    style={{ border: dragZip[t.id] ? '2px dashed #ffd700' : '2px dashed #333', borderRadius:8, padding:6, display:'flex', flexDirection:'column', alignItems:'stretch', gap:4 }}
                  >
                    <button type="button" onClick={() => document.getElementById(`zip_${t.id}`).click()} style={{ background: uploadingZip[t.id]?'#444':'#222', color:'#ffd700', border:'1px solid #555', borderRadius:6, padding:'6px 8px', cursor: uploadingZip[t.id]?'default':'pointer', fontWeight:600, fontSize:12 }}>{uploadingZip[t.id] ? 'ZIP…' : 'ZIP'}</button>
                    <span style={{ textAlign:'center', fontSize:10, color:'#888' }}>Drag & Drop</span>
                  </div>
                  {t.downloadLink ? <a href={t.downloadLink} target="_blank" rel="noreferrer" style={{ color:'#ffd700', fontSize:12 }}>Download</a> : <span style={{ color:'#777', fontSize:12 }}>manca</span>}
                </div>
                <input type="text" value={edit.price ?? (t.price ?? '')} onChange={e => changeField(t,'price', e.target.value)} placeholder="Prezzo" style={{ padding:8, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff' }} />
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <button onClick={() => saveTrack(t)} style={{ background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'6px 12px', fontWeight:700, cursor:'pointer' }}>Salva</button>
                  {(edit.paymentLinkUrl || t.paymentLinkUrl) && (
                    <button onClick={() => { const link = edit.paymentLinkUrl || t.paymentLinkUrl; if (link) window.open(link,'_blank','noopener,noreferrer'); }} style={{ background:'#333', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'6px 12px', fontWeight:600, cursor:'pointer' }}>Test</button>
                  )}
                  <button onClick={() => deleteTrack(t)} style={{ background:'#3b0f0f', color:'#ff9393', border:'1px solid #aa2b2b', borderRadius:8, padding:'6px 10px', fontWeight:600, cursor:'pointer' }}>Elimina</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
