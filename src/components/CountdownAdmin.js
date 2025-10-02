import React, { useMemo, useState } from 'react';
import { db, storage } from './firebase';
import { collection, addDoc, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function CountdownAdmin({ items, uploading, setUploading }) {
  const [title, setTitle] = useState('');
  const [order, setOrder] = useState('');
  const [releaseAt, setReleaseAt] = useState(''); // HTML datetime-local string
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
    setTitle(''); setOrder(''); setReleaseAt(''); setFile(null);
    try { const el = document.getElementById('countdown-file'); if (el) el.value = ''; } catch {}
  };

  const addItem = async () => {
    try {
      if (!releaseAt) {
        alert('Imposta la data/ora di uscita');
        return;
      }
      setUploading(true);
      let coverUrl = '';
      if (file) {
        const path = `countdowns/${Date.now()}_${file.name}`;
        const r = ref(storage, path);
        await uploadBytes(r, file);
        coverUrl = await getDownloadURL(r);
      }
      const releaseDate = new Date(releaseAt);
      if (isNaN(releaseDate.getTime())) {
        alert('Data/ora non valida');
        setUploading(false);
        return;
      }
      const payload = {
        title: title || null,
        order: Number.isFinite(Number(order)) ? Number(order) : null,
        coverUrl: coverUrl || null,
        releaseAt: releaseDate,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'countdowns'), payload);
      resetForm();
      alert('Countdown inserito');
    } catch (e) {
      console.error('Errore inserimento countdown', e);
      alert('Errore inserimento: ' + (e && e.message ? e.message : 'sconosciuto'));
    } finally {
      setUploading(false);
    }
  };

  const saveOrder = async (id, val) => {
    try {
      const num = Number(val);
      await setDoc(doc(db, 'countdowns', id), { order: Number.isFinite(num) ? num : null }, { merge: true });
    } catch (e) {
      console.error('Errore salvataggio ordine', e);
      alert('Errore salvataggio ordine');
    }
  };

  const delItem = async (id) => {
    try {
      if (!window.confirm('Eliminare definitivamente questo countdown?')) return;
      await deleteDoc(doc(db, 'countdowns', id));
    } catch (e) {
      console.error('Errore eliminazione countdown', e);
      alert('Errore eliminazione');
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, maxWidth: 760 }}>
        <label style={{ color: '#ffd700' }}>Titolo (opzionale)
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Nuovo singolo XYZ" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
        </label>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ color: '#ffd700', flex: '1 1 180px' }}>Ordine
            <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="Es. 1" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
          </label>
          <label style={{ color: '#ffd700', flex: '2 1 280px' }}>Data/ora uscita
            <input type="datetime-local" value={releaseAt} onChange={(e) => setReleaseAt(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', marginTop: 6 }} />
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input id="countdown-file" type="file" accept="image/*" onChange={(e) => setFile(e.target.files && e.target.files[0])} disabled={uploading} />
          <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById('countdown-file').click()} disabled={uploading}>
            {uploading ? 'Caricamento…' : 'Seleziona Copertina'}
          </button>
        </div>
        <div>
          <button className="dash-btn dash-btn--primary" onClick={addItem} disabled={uploading}>Aggiungi Countdown</button>
          <button className="dash-btn dash-btn--ghost" onClick={resetForm} disabled={uploading} style={{ marginLeft: 8 }}>Pulisci</button>
        </div>
      </div>

      <h4 className="dash-section-title" style={{ marginTop: 18 }}>Countdown esistenti</h4>
      {sorted.length === 0 ? (
        <div style={{ color: '#888' }}>Nessun elemento.</div>
      ) : (
        <ul>
          {sorted.map(item => (
            <li key={item.id} className="dash-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={item.coverUrl || '/logo.png'} alt="cover" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{item.title || 'Senza titolo'}</strong>
                  <small style={{ opacity: 0.85 }}>Uscita: {(() => { try { const d = item.releaseAt?.toDate ? item.releaseAt.toDate() : (item.releaseAt?.seconds ? new Date(item.releaseAt.seconds * 1000) : (item.releaseAt ? new Date(item.releaseAt) : null)); return d ? d.toLocaleString() : '—'; } catch { return '—'; } })()}</small>
                </div>
              </div>
              <div className="dash-item-actions" style={{ alignItems: 'center', gap: 8 }}>
                <input type="number" value={item.order ?? ''} onChange={(e) => { const v = e.target.value; item.order = v; saveOrder(item.id, v); }} placeholder="Ordine" style={{ width: 90, padding: '6px 8px', borderRadius: 6, border: '1px solid #444', background: '#111', color: '#fff' }} />
                <button className="dash-small-btn dash-small-btn--danger" onClick={() => delItem(item.id)}>Elimina</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
