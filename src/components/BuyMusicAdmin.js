import React, { useEffect, useState } from 'react';
import Footer from './Footer';
import { db, storage } from './firebase';
import { collection, addDoc, deleteDoc, setDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function BuyMusicAdmin() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [studioVideoUrl, setStudioVideoUrl] = useState('');
  useEffect(() => {
    const unsubStudio = onSnapshot(doc(db, 'site', 'config'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      setStudioVideoUrl(data?.studioVideoUrl || '');
    });
    return () => unsubStudio();
  }, []);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newGenre, setNewGenre] = useState({ name: '', order: 0, coverUrl: '', defaultPrice: '' });
  // Stato per tracce per genere non utilizzato qui; ogni blocco tracce gestisce i propri dati

  useEffect(() => {
    // Legge tutti i generi senza orderBy per includere anche i documenti storici senza createdAt
    const unsub = onSnapshot(
      collection(db, 'buyGenres'),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordine in memoria: createdAt asc, fallback a name/id
        list.sort((a, b) => {
          const ams = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
          const bms = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
          if (ams !== bms) return ams - bms;
          const an = (a.name || '').localeCompare(b.name || '');
          if (an !== 0) return an;
          return (a.id || '').localeCompare(b.id || '');
        });
        setGenres(list);
      },
      (err) => {
        console.error('[BuyMusicAdmin] Errore lettura generi:', err);
        alert('Errore nel leggere la lista generi: ' + (err?.message || String(err)));
      }
    );
    return () => unsub();
  }, []);

  const createGenre = async () => {
    if (!newGenre.name.trim()) return alert('Inserisci un nome genere');
    try {
      setLoading(true);
      // parse default price (accetta virgola)
      let dp = null;
      if (newGenre.defaultPrice !== undefined && newGenre.defaultPrice !== null && String(newGenre.defaultPrice).trim() !== '') {
        const parsed = parseFloat(String(newGenre.defaultPrice).replace(',', '.'));
        dp = Number.isFinite(parsed) ? parsed : null;
      }
      await addDoc(collection(db, 'buyGenres'), {
        name: newGenre.name.trim(),
        order: Number(newGenre.order) || 0,
        coverUrl: newGenre.coverUrl || '',
        defaultPrice: dp,
        createdAt: serverTimestamp()
      });
      setNewGenre({ name: '', order: 0, coverUrl: '', defaultPrice: '' });
    } catch (e) {
      console.error('Errore creazione genere', e);
      alert('Errore creazione genere');
    } finally {
      setLoading(false);
    }
  };

  const uploadGenreCover = async (file, gid) => {
    if (!file) return;
    try {
      const r = ref(storage, `buy/genres/${gid}_${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'buyGenres', gid), { coverUrl: url }, { merge: true });
    } catch (e) {
      console.error('Errore upload cover genere', e);
      alert('Errore upload cover');
    }
  };

  const saveGenre = async (g) => {
    try {
      let dp = null;
      if (g.defaultPrice !== undefined && g.defaultPrice !== null && String(g.defaultPrice).trim() !== '') {
        if (typeof g.defaultPrice === 'number' && !Number.isNaN(g.defaultPrice)) {
          dp = g.defaultPrice;
        } else {
          const parsed = parseFloat(String(g.defaultPrice).replace(',', '.'));
          dp = Number.isFinite(parsed) ? parsed : null;
        }
      }
      await setDoc(doc(db, 'buyGenres', g.id), {
        name: g.name || '',
        order: Number(g.order) || 0,
        coverUrl: g.coverUrl || '',
        defaultPrice: dp
      }, { merge: true });
      alert('Genere aggiornato');
    } catch (e) {
      console.error('Errore salvataggio genere', e);
      alert('Errore salvataggio genere');
    }
  };

  const deleteGenre = async (gid) => {
    if (!window.confirm('Eliminare definitivamente questo genere? (Le tracce nel sottolivello resteranno orfane)')) return;
    try {
      await deleteDoc(doc(db, 'buyGenres', gid));
    } catch (e) {
      console.error('Errore eliminazione genere', e);
    }
  };

  const addTrack = async (gid, defaultPrice) => {
    const title = prompt('Titolo brano:');
    if (!title) return;
    try {
      await addDoc(collection(db, 'buyGenres', gid, 'tracks'), {
        title: title.trim(),
        order: 0,
        audioUrl: '',
        paymentLinkUrl: '',
        paypalLinkUrl: '',
        downloadLink: '',
        sold: false,
        price: (typeof defaultPrice === 'number' && !Number.isNaN(defaultPrice)) ? defaultPrice : null,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Errore creazione brano', e);
      alert('Errore creazione brano');
    }
  };

  const uploadTrackAudio = async (gid, tid, file) => {
    if (!file) return;
    try {
      const r = ref(storage, `buy/tracks/${gid}_${tid}_${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'buyGenres', gid, 'tracks', tid), { audioUrl: url }, { merge: true });
    } catch (e) {
      console.error('Errore upload audio brano', e);
      alert('Errore upload audio brano');
    }
  };

  const uploadTrackZip = async (gid, tid, file, setLocalTracks) => {
    if (!file) return;
    try {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const r = ref(storage, `buy/zips/${gid}_${tid}_${Date.now()}_${safeName}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await setDoc(doc(db, 'buyGenres', gid, 'tracks', tid), { downloadLink: url }, { merge: true });
      setLocalTracks(list => list.map(x => x.id === tid ? { ...x, downloadLink: url } : x));
    } catch (e) {
      console.error('Errore upload ZIP', e);
      alert('Errore upload ZIP');
    }
  };

  const saveTrack = async (gid, t) => {
    try {
      // Normalizza prezzo accettando anche stringhe con virgola
      let priceVal = null;
      if (t.price !== undefined && t.price !== null && String(t.price).trim() !== '') {
        if (typeof t.price === 'number' && !Number.isNaN(t.price)) {
          priceVal = t.price;
        } else {
          const parsed = parseFloat(String(t.price).replace(',', '.'));
          priceVal = Number.isFinite(parsed) ? parsed : null;
        }
      }
      await setDoc(doc(db, 'buyGenres', gid, 'tracks', t.id), {
        title: t.title || '',
        order: Number(t.order) || 0,
        audioUrl: t.audioUrl || '',
        paymentLinkUrl: t.paymentLinkUrl || '',
        paypalLinkUrl: t.paypalLinkUrl || '',
        downloadLink: t.downloadLink || '',
        sold: !!t.sold,
        price: priceVal
      }, { merge: true });
      alert('Brano aggiornato');
    } catch (e) {
      console.error('Errore salvataggio brano', e);
      alert('Errore salvataggio brano');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding:'24px 20px', maxWidth:1200, margin:'0 auto' }}>
      <h1 style={{ color:'#ffd700', margin:0, fontSize:'1.9rem' }}>Buy Music – Admin</h1>
      {/* Sezione creazione genere */}
      <section style={{ background:'#161616', border:'1px solid #333', borderRadius:14, padding:20, boxShadow:'0 0 14px rgba(255,215,0,0.15)' }}>
        <h2 style={{ color:'#ffd700', marginTop:0, fontSize:'1.2rem' }}>Nuovo Genere</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 120px 1fr 120px 140px', gap:12, alignItems:'center', maxWidth:860 }}>
          <input type="text" placeholder="Nome" value={newGenre.name} onChange={e => setNewGenre(g => ({ ...g, name: e.target.value }))} style={genreInputStyle} />
            <input type="number" placeholder="Ordine" value={newGenre.order} onChange={e => setNewGenre(g => ({ ...g, order: e.target.value }))} style={genreInputStyle} />
            <input type="url" placeholder="Cover URL (opz)" value={newGenre.coverUrl} onChange={e => setNewGenre(g => ({ ...g, coverUrl: e.target.value }))} style={genreInputStyle} />
            <input type="text" placeholder="Prezzo Default (€)" value={newGenre.defaultPrice} onChange={e => setNewGenre(g => ({ ...g, defaultPrice: e.target.value }))} style={genreInputStyle} />
            <button onClick={createGenre} disabled={loading} style={primaryBtn}>{loading ? 'Creazione…' : 'Crea Genere'}</button>
        </div>
      </section>

      {/* Lista generi */}
      <section style={{ display:'flex', flexDirection:'column', gap:28 }}>
        {genres.length === 0 ? (
          <div style={{ color:'#ffd700' }}>Nessun genere ancora creato.</div>
        ) : genres.map(g => (
          <div key={g.id} style={{ background:'#141414', border:'1px solid #333', borderRadius:18, padding:20, boxShadow:'0 0 10px rgba(0,0,0,0.4)', display:'flex', flexDirection:'column', gap:16 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
              <input type="text" value={g.name || ''} onChange={e => setGenres(list => list.map(x => x.id===g.id ? { ...x, name: e.target.value } : x))} placeholder="Nome" style={genreInputStyle} />
              <input type="number" value={g.order ?? 0} onChange={e => setGenres(list => list.map(x => x.id===g.id ? { ...x, order: e.target.value } : x))} placeholder="Ordine" style={genreInputStyle} />
              <input type="url" value={g.coverUrl || ''} onChange={e => setGenres(list => list.map(x => x.id===g.id ? { ...x, coverUrl: e.target.value } : x))} placeholder="Cover URL" style={genreInputStyle} />
              <input type="text" value={g.defaultPrice ?? ''} onChange={e => setGenres(list => list.map(x => x.id===g.id ? { ...x, defaultPrice: e.target.value } : x))} placeholder="Prezzo Default" style={genreInputStyle} />
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={() => saveGenre(g)} style={secondaryBtn}>Salva</button>
                <button onClick={() => addTrack(g.id, g.defaultPrice)} style={primaryBtnSm}>+ Traccia</button>
                <button onClick={() => deleteGenre(g.id)} style={dangerBtn}>Elimina</button>
                <label style={{ ...miniBtn, cursor:'pointer' }}>
                  <span style={{ pointerEvents:'none' }}>Cover</span>
                  <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => uploadGenreCover(e.target.files && e.target.files[0], g.id)} />
                </label>
              </div>
            </div>
            {g.coverUrl && <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
              <img src={g.coverUrl} alt={g.name} style={{ width:120, height:120, objectFit:'cover', borderRadius:12, border:'1px solid #222' }} />
              <div style={{ flex:1, fontSize:12, color:'#aaa' }}>ID: {g.id}</div>
            </div>}
            <div>
              <h3 style={{ color:'#ffd700', margin:'8px 0 12px 0', fontSize:'1.05rem' }}>Tracce</h3>
              <GenreTracks gid={g.id} onUploadAudio={uploadTrackAudio} onUploadZip={uploadTrackZip} onSaveTrack={saveTrack} />
            </div>
          </div>
        ))}
      </section>
      {/* Overlay video studio */}
      {showOverlay && studioVideoUrl && (
        <div className="fullscreen-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.97)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowOverlay(false)}>
          <video src={studioVideoUrl} autoPlay controls loop playsInline
            style={{ width: '100vw', height: '100vh', objectFit: 'contain', background: '#000' }}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={() => setShowOverlay(false)} style={{ position: 'absolute', top: 24, right: 32, fontSize: 32, color: '#ffd700', background: 'none', border: 'none', cursor: 'pointer', zIndex: 10000 }}>×</button>
        </div>
      )}
      <Footer showArteButton={true} onArteClick={() => setShowOverlay(true)} />
    </div>
  );
}

// Inline style objects (per evitare duplicazioni non necessarie in CSS già esistente)
const genreInputStyle = { padding:10, borderRadius:8, border:'1px solid #444', background:'#111', color:'#fff', minWidth:110 };
const primaryBtn = { background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'10px 16px', fontWeight:700, cursor:'pointer', boxShadow:'0 0 8px #ffd700' };
const primaryBtnSm = { background:'#ffd700', color:'#222', border:'none', borderRadius:8, padding:'8px 12px', fontWeight:700, cursor:'pointer' };
const secondaryBtn = { background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'8px 14px', fontWeight:600, cursor:'pointer' };
const dangerBtn = { background:'#5d1f1f', color:'#ffb3b3', border:'1px solid #772828', borderRadius:8, padding:'8px 12px', fontWeight:600, cursor:'pointer' };
const miniBtn = { background:'#222', color:'#ffd700', border:'1px solid #555', borderRadius:8, padding:'8px 12px', fontWeight:600, display:'inline-flex', alignItems:'center', gap:4 };

function GenreTracks({ gid, onUploadAudio, onUploadZip, onSaveTrack }) {
  const [tracks, setTracks] = useState([]);
  const [zipUploading, setZipUploading] = useState({});
  useEffect(() => {
    // Legge tutti i brani senza orderBy per includere anche quelli storici senza campi ordine
    const unsub = onSnapshot(collection(db, 'buyGenres', gid, 'tracks'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Ordina in memoria: order asc, poi createdAt asc, poi title
      list.sort((a, b) => {
        const ao = Number(a.order ?? Number.MAX_SAFE_INTEGER);
        const bo = Number(b.order ?? Number.MAX_SAFE_INTEGER);
        if (ao !== bo) return ao - bo;
        const ac = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        const bc = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : Number.MAX_SAFE_INTEGER);
        if (ac !== bc) return ac - bc;
        return (a.title || '').localeCompare(b.title || '');
      });
      setTracks(list);
    });
    return () => unsub();
  }, [gid]);

  return (
    <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
      {tracks.map((t) => (
        <div key={t.id} style={{ background: '#111', border: '1px solid #333', borderRadius: 10, padding: 10, display: 'grid', gridTemplateColumns: '2fr 90px 1fr 1.1fr 1.1fr 1fr 160px 120px', gap: 8, alignItems: 'center' }}>
          <input type="text" value={t.title || ''} onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, title: e.target.value } : x))} placeholder="Titolo" style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
          <input type="number" value={t.order ?? 0} onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, order: e.target.value } : x))} placeholder="Ord." style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', width: 90 }} />
          <div>
            <input id={`audio_${gid}_${t.id}`} type="file" accept="audio/*" style={{ display: 'none' }} onChange={e => onUploadAudio(gid, t.id, e.target.files && e.target.files[0])} />
            <button className="dash-small-btn dash-small-btn--primary" onClick={() => document.getElementById(`audio_${gid}_${t.id}`).click()}>Audio</button>
            {t.audioUrl ? <a href={t.audioUrl} target="_blank" rel="noreferrer" style={{ color: '#ffd700', marginLeft: 6 }}>Apri</a> : <span style={{ color: '#888', marginLeft: 6 }}>manca</span>}
          </div>
          <input type="url" value={t.paymentLinkUrl || ''} onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, paymentLinkUrl: e.target.value } : x))} placeholder="Stripe Payment Link (URL)" style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
          <input type="url" value={t.paypalLinkUrl || ''} onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, paypalLinkUrl: e.target.value } : x))} placeholder="PayPal Link (URL)" style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <input type="url" value={t.downloadLink || ''} onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, downloadLink: e.target.value } : x))} placeholder="Link download post-pagamento (opzionale)" style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff' }} />
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input id={`zip_${gid}_${t.id}`} type="file" accept=".zip,application/zip" style={{ display:'none' }} onChange={async e => {
                const f = e.target.files && e.target.files[0];
                if (f) {
                  setZipUploading(p => ({ ...p, [t.id]: true }));
                  await onUploadZip(gid, t.id, f, setTracks);
                  setZipUploading(p => ({ ...p, [t.id]: false }));
                }
                e.target.value='';
              }} />
              <button className="dash-small-btn" style={{ background: zipUploading[t.id] ? '#444' : '#222', color:'#ffd700' }} disabled={zipUploading[t.id]} onClick={() => document.getElementById(`zip_${gid}_${t.id}`).click()}>{zipUploading[t.id] ? 'Upload…' : 'ZIP'}</button>
              {t.downloadLink && <a href={t.downloadLink} target="_blank" rel="noreferrer" style={{ color:'#ffd700', fontSize:12 }}>Apri ZIP</a>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <input type="text" inputMode="decimal" pattern="[0-9]+([\.,][0-9]{1,2})?" min="0" placeholder="Prezzo (€)"
              value={t.price ?? ''}
              onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, price: e.target.value } : x))}
              style={{ padding: 10, borderRadius: 8, border: '1px solid #444', background: '#111', color: '#fff', width: 140 }} />
            <span style={{ marginTop: 4, fontSize: 12, color: '#bbb' }}>
              {(() => { const raw = t.price; if (raw === '' || raw === null || raw === undefined) return 'Anteprima: —'; const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.')); return Number.isFinite(num) ? `Anteprima: € ${num.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Anteprima: —'; })()}
            </span>
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ddd', userSelect: 'none' }} title="Stato di disponibilità del brano">
            <input
              type="checkbox"
              checked={!!t.sold}
              onChange={e => setTracks(list => list.map(x => x.id === t.id ? { ...x, sold: e.target.checked } : x))}
            />
            Venduto
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="dash-small-btn"
              onClick={() => {
                const link = (tracks.find(x => x.id === t.id) || {}).paymentLinkUrl;
                if (link) window.open(link, '_blank', 'noopener,noreferrer');
              }}
              disabled={!((tracks.find(x => x.id === t.id) || {}).paymentLinkUrl)}
              title={((tracks.find(x => x.id === t.id) || {}).paymentLinkUrl) ? 'Apri Payment Link in nuova scheda' : 'Imposta prima il Payment Link'}
            >
              Test Payment Link
            </button>
            <button
              className="dash-small-btn"
              onClick={() => {
                const link = (tracks.find(x => x.id === t.id) || {}).paypalLinkUrl;
                if (link) window.open(link, '_blank', 'noopener,noreferrer');
              }}
              disabled={!((tracks.find(x => x.id === t.id) || {}).paypalLinkUrl)}
              title={((tracks.find(x => x.id === t.id) || {}).paypalLinkUrl) ? 'Apri PayPal in nuova scheda' : 'Imposta prima il link PayPal'}
            >
              Test PayPal
            </button>
            <button className="dash-small-btn dash-small-btn--primary" onClick={() => onSaveTrack(gid, tracks.find(x => x.id === t.id))}>Salva brano</button>
          </div>
        </div>
      ))}
    </div>
  );
}
