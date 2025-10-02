import React, { useMemo, useState } from 'react';
import { db, storage } from './firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function PodcastAdmin({ items, uploading, setUploading }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState(null);

  const sorted = useMemo(() => {
    const list = [...(items || [])];
    list.sort((a, b) => {
      const ao = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.POSITIVE_INFINITY;
      const bo = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
      const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
      return ams - bms;
    });
    return list;
  }, [items]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setOrder(''); setYoutubeUrl(''); setFile(null);
    try { const el = document.getElementById('podcast-file'); if (el) el.value = ''; } catch {}
  };

  const addItem = async () => {
    try {
      setUploading(true);
      let videoUrl = '';
      if (file) {
        const path = `podcasts/${Date.now()}_${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file);
        videoUrl = await getDownloadURL(r);
      }
      const payload = {
        title: title || null,
        description: description || null,
        order: Number.isFinite(Number(order)) ? Number(order) : null,
        youtubeUrl: youtubeUrl || null,
        videoUrl: videoUrl || null,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'podcasts'), payload);
      resetForm();
      alert('Podcast inserito');
    } catch (e) {
      console.error('Errore inserimento podcast', e);
      alert('Errore inserimento: ' + (e && e.message ? e.message : 'sconosciuto'));
    } finally {
      setUploading(false);
    }
  };

  const saveOrder = async (id, val) => {
    try {
      const num = Number(val);
      await setDoc(doc(db, 'podcasts', id), { order: Number.isFinite(num) ? num : null }, { merge: true });
    } catch (e) {
      console.error('Errore salvataggio ordine', e);
      alert('Errore salvataggio ordine');
    }
  };

  const delItem = async (id) => {
    try {
      if (!window.confirm('Eliminare definitivamente questo contenuto?')) return;
      await deleteDoc(doc(db, 'podcasts', id));
    } catch (e) {
      console.error('Errore eliminazione podcast', e);
      alert('Errore eliminazione');
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 760 }}>
        <label style={{ color: '#ffd700' }}>Titolo
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Intervista a ..." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
        </label>
        <label style={{ color: '#ffd700' }}>Descrizione
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Breve descrizione" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ color: '#ffd700', flex: '1 1 180px' }}>Ordine
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Es. 1" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
          </label>
          <label style={{ color: '#ffd700', flex: '2 1 280px' }}>Link YouTube (opzionale)
            <input type="url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=... oppure https://youtu.be/..." style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input id="podcast-file" type="file" accept="video/*" onChange={(e) => setFile(e.target.files && e.target.files[0])} disabled={uploading} />
          <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('podcast-file').click()} disabled={uploading}>
            {uploading ? 'Caricamento…' : 'Seleziona Video (4K OK)'}
          </button>
        </div>
        <div>
          <button className="dash-btn dash-btn--primary" onClick={addItem} disabled={uploading}>Aggiungi Podcast</button>
          <button className="dash-btn dash-btn--ghost" onClick={resetForm} disabled={uploading} style={{ marginLeft: 8 }}>Pulisci</button>
        </div>
      </div>

      <h4 className="dash-section-title" style={{ marginTop: 18 }}>Contenuti esistenti</h4>
      {sorted.length === 0 ? (
        <div style={{ color: '#888' }}>Nessun contenuto.</div>
      ) : (
        <ul>
          {sorted.map(item => (
            <li key={item.id} className="dash-item">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <strong>{item.title || 'Senza titolo'}</strong>
                <small style={{ opacity: 0.85 }}>{item.description || ''}</small>
                {item.youtubeUrl ? (<small><em>YouTube:</em> <a href={item.youtubeUrl} target="_blank" rel="noreferrer">Apri</a></small>) : null}
                {item.videoUrl ? (<small><em>Video:</em> <a href={item.videoUrl} target="_blank" rel="noreferrer">Apri</a></small>) : null}
              </div>
              <div className="dash-item-actions" style={{ alignItems: 'center', gap: 8 }}>
                <input type="number" value={item.order ?? ''} onChange={(e) => {
                  const v = e.target.value;
                  // ottimistica: aggiorna locale e poi salva
                  item.order = v;
                  saveOrder(item.id, v);
                }} placeholder="Ordine" style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#111', color: '#fff' }} />
                <button className="dash-small-btn dash-small-btn--danger" onClick={() => delItem(item.id)}>Elimina</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
