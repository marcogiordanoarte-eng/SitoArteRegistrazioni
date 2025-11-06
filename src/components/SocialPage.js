import React, { useEffect, useState } from 'react';
import { auth, rtdb, storage, loginWithGooglePopup } from '../services/firebase';
import { ref as dbRef, onValue, query, orderByChild, limitToLast, runTransaction, serverTimestamp, push, set, get } from 'firebase/database';
import { ref as sRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

// Minimal Social (React) replacing the embedded static page
// Features: public feed, login, artist-gated compose with image upload, RSVP, likes, delete own posts
export default function SocialPage(){
  const [user, setUser] = useState(null);
  const [isArtist, setIsArtist] = useState(false);
  const [status, setStatus] = useState('');
  const [feed, setFeed] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [useLocation, setUseLocation] = useState(false);
  const [userGeo, setUserGeo] = useState(null); // {lat,lng}

  // Compose state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState('');
  const [desc, setDesc] = useState('');
  const [image, setImage] = useState(null);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (!u) { setIsArtist(false); return; }
      try {
        const snap = await get(dbRef(rtdb, `users/${u.uid}/isArtist`));
        setIsArtist(snap.exists() && snap.val() === true);
      } catch { setIsArtist(false); }
    });
    return () => unsub();
  }, []);

  // Feed listener
  useEffect(() => {
    const q = query(dbRef(rtdb, 'posts'), orderByChild('createdAt'), limitToLast(50));
    return onValue(q, (snap) => {
      const val = snap.val() || {};
      const list = Object.entries(val).map(([key, data]) => ({ id: key, ...data }))
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setFeed(list);
    });
  }, []);

  // Geolocation
  useEffect(() => {
    if (!useLocation) return;
    if (!('geolocation' in navigator)) return;
    const t = navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords || {};
      if (typeof latitude === 'number' && typeof longitude === 'number') {
        setUserGeo({ lat: latitude, lng: longitude });
      }
    });
    return () => { try { if (t && t.remove) t.remove(); } catch(_) {} };
  }, [useLocation]);

  async function ensureLogin() {
    if (user) return true;
    setStatus('Accesso in corso…');
    try { await loginWithGooglePopup(); setStatus(''); return true; } catch(e) { setStatus('Accesso non riuscito'); return false; }
  }

  async function handlePublish(e){
    e.preventDefault();
    if (!user) { setStatus('Accedi per pubblicare.'); return; }
    if (!isArtist) { setStatus('Solo gli artisti possono pubblicare.'); return; }
    const vTitle = title.trim();
    const vDate = date.trim();
    const vCity = city.trim();
    const vDesc = desc.trim();
    if (!vTitle || !vDate || !vCity || !vDesc) { setStatus('Compila tutti i campi.'); return; }
    setSubmitting(true); setStatus('Pubblicazione…'); setProg(0);
    try {
      const postsRoot = dbRef(rtdb, 'posts');
      const newRef = push(postsRoot);
      let imageUrl = '';
      if (image) {
        const safe = image.name ? image.name.replace(/[^a-zA-Z0-9._-]/g, '_') : 'file.jpg';
        const path = `images/${user.uid}/${newRef.key}/${Date.now()}_${safe}`;
        const upRef = sRef(storage, path);
        await new Promise((resolve, reject) => {
          const t = uploadBytesResumable(upRef, image);
          t.on('state_changed', (snap) => {
            if (snap.totalBytes) setProg(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }, reject, resolve);
        });
        imageUrl = await getDownloadURL(sRef(storage, path));
      }
      const payload = {
        title: vTitle,
        date: vDate,
        city: vCity,
        desc: vDesc,
        imageUrl,
        userName: user.displayName || user.email || 'Utente',
        userId: user.uid,
        rsvp: 0,
        likesCount: 0,
        createdAt: serverTimestamp(),
      };
      if (useLocation && userGeo) { payload.lat = userGeo.lat; payload.lng = userGeo.lng; }
      await set(newRef, payload);
      setTitle(''); setDate(''); setCity(''); setDesc(''); setImage(null); setProg(0);
      setStatus('Pubblicato.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e) {
      setStatus('Errore durante la pubblicazione.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRSVP(postId){
    if (!user) { setStatus('Accedi per partecipare.'); return; }
    const r = dbRef(rtdb, `posts/${postId}/rsvp`);
    try { await runTransaction(r, (n) => (Number(n) || 0) + 1); } catch (_) {}
  }

  async function handleLike(postId){
    if (!user) { setStatus('Accedi per mettere Mi piace.'); return; }
    const likeRef = dbRef(rtdb, `posts/${postId}/likes/${user.uid}`);
    try {
      const res = await runTransaction(likeRef, (cur) => {
        if (cur === true) return; // no-op
        return true;
      });
      if (res && res.committed) {
        await runTransaction(dbRef(rtdb, `posts/${postId}/likesCount`), (n) => (Number(n) || 0) + 1);
      }
    } catch (_){ /* ignore */ }
  }

  async function handleDelete(post){
    if (!user || user.uid !== post.userId) return;
    const ok = window.confirm('Eliminare questo post?');
    if (!ok) return;
    try {
      await set(dbRef(rtdb, `posts/${post.id}`), null);
      if (post.imageUrl) {
        try { await deleteObject(sRef(storage, post.imageUrl)); } catch(_) {}
      }
    } catch(_) {}
  }

  const canPublish = !!user && isArtist;
  const fmtDate = (d) => {
    if (!d) return '';
    try { const [y,m,dd] = String(d).split('-').map(Number); return new Date(y, (m-1), dd).toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' }); } catch { return String(d); }
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '16px' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h1 style={{ margin: 0, color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,.35)' }}>Social Sounds</h1>
        <div>
          {!user ? (
            <button className="ss-btn" onClick={ensureLogin}>Entra</button>
          ) : (
            <div style={{ color: '#cbd5e1', fontSize: 14 }}>Connesso come {user.displayName || user.email}</div>
          )}
        </div>
      </header>

      {status ? <div style={{ color: '#a7f3d0', marginBottom: 10 }}>{status}</div> : null}

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#cbd5e1' }}>
            <input type="checkbox" checked={useLocation} onChange={(e)=> setUseLocation(e.target.checked)} /> Usa la mia posizione
          </label>
        </div>

        <form onSubmit={handlePublish} style={{ border: '1px solid #1f2937', borderRadius: 10, padding: 12, background: '#0b1220' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color:'#94a3b8' }}>Titolo</span>
              <input value={title} onChange={(e)=> setTitle(e.target.value)} required disabled={!canPublish} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color:'#94a3b8' }}>Data</span>
              <input type="date" value={date} onChange={(e)=> setDate(e.target.value)} required disabled={!canPublish} />
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color:'#94a3b8' }}>Città</span>
              <input value={city} onChange={(e)=> setCity(e.target.value)} required disabled={!canPublish} />
            </label>
            <label style={{ display: 'grid', gap: 4 }}>
              <span style={{ color:'#94a3b8' }}>Volantino (opzionale)</span>
              <input type="file" accept="image/*" onChange={(e)=> setImage(e.target.files?.[0] || null)} disabled={!canPublish} />
            </label>
          </div>
          <label style={{ display: 'grid', gap: 4, marginTop: 10 }}>
            <span style={{ color:'#94a3b8' }}>Descrizione</span>
            <textarea rows={3} value={desc} onChange={(e)=> setDesc(e.target.value)} required disabled={!canPublish} />
          </label>
          {image ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ color:'#94a3b8', fontSize: 13, marginBottom: 4 }}>Anteprima</div>
              <img alt="Preview" src={URL.createObjectURL(image)} style={{ maxWidth: '100%', borderRadius: 8 }} />
            </div>
          ) : null}
          {submitting ? (
            <div style={{ marginTop: 10, height: 6, background:'#0f172a', borderRadius: 6 }}>
              <div style={{ width: `${prog}%`, height: 6, background:'#60a5fa', borderRadius: 6, transition: 'width .2s' }} />
            </div>
          ) : null}
          <div style={{ marginTop: 12 }}>
            <button className="ss-btn ss-btn-primary" disabled={!canPublish || submitting} type="submit">Pubblica</button>
            {!user && (
              <button type="button" className="ss-btn ss-btn-ghost" style={{ marginLeft: 8 }} onClick={ensureLogin}>Accedi</button>
            )}
            {user && !isArtist && (
              <span style={{ marginLeft: 10, color:'#fca5a5' }}>Solo artisti verificati possono pubblicare</span>
            )}
          </div>
        </form>
      </section>

      <section>
        <h2 style={{ color:'#e5e7eb', margin: '12px 0' }}>Eventi</h2>
        {feed.length === 0 ? (
          <div style={{ color:'#94a3b8' }}>Nessun evento pubblicato.</div>
        ) : (
          <div style={{ display:'grid', gap: 12 }}>
            {feed.map(p => (
              <article key={p.id} style={{ border:'1px solid #1f2937', background:'#0b1220', borderRadius: 10, padding: 12 }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title || 'Evento'} style={{ width:'100%', height:'auto', borderRadius: 8, marginBottom: 8 }} />
                ) : null}
                <div style={{ display: 'flex', justifyContent:'space-between', alignItems:'center', gap: 8 }}>
                  <h3 style={{ margin: 0, color:'#e5e7eb' }}>{p.title}</h3>
                  {user && user.uid === p.userId ? (
                    <button className="ss-btn ss-btn-danger" onClick={()=> handleDelete(p)}>Elimina</button>
                  ) : null}
                </div>
                <div style={{ color:'#94a3b8', fontSize: 14, marginTop: 4 }}>
                  <span>{fmtDate(p.date)}</span>
                  {p.city ? <span> • {p.city}</span> : null}
                  {p.userName ? <span> • {p.userName}</span> : null}
                </div>
                {p.desc ? <p style={{ color:'#cbd5e1', marginTop: 8 }}>{p.desc}</p> : null}
                <div style={{ display:'flex', gap: 10, marginTop: 8 }}>
                  <button className="ss-btn ss-btn-ghost" onClick={()=> handleRSVP(p.id)}>Partecipo</button>
                  <span className="ss-pill">{Number(p.rsvp || 0)} RSVP</span>
                  <button className="ss-btn ss-btn-ghost" onClick={()=> handleLike(p.id)}>Mi piace</button>
                  <span className="ss-pill">{Number(p.likesCount || 0)} Mi piace</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
