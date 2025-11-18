import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, rtdb, storage, googleProvider } from '../firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { ref as dbRef, onValue, push, set, serverTimestamp as rtdbServerTimestamp, runTransaction, update } from 'firebase/database';
import { ref as stRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable, getFunctions } from 'firebase/functions';

// Dark neon inline styles kept minimal; inherits global site styles (Inter font, neon palette)

export default function SocialPage() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('fan'); // 'fan' | 'artist'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ipiIsni, setIpiIsni] = useState('');
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [aspect, setAspect] = useState('9:16'); // '9:16' | '1:1'
  const [posts, setPosts] = useState([]);
  const observers = useRef(null);
  const timers = useRef({});
  const [musicQuery, setMusicQuery] = useState('');
  const [trackMeta, setTrackMeta] = useState(null); // {source:'spotify'|'apple', data:{...}}

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
      if (u) {
        // Ensure minimal profile present
        const uref = dbRef(rtdb, `users/${u.uid}`);
        onValue(uref, (snap) => {
          const v = snap.val();
          if (!snap.exists()) {
            set(uref, {
              email: u.email || null,
              role: 'fan',
              createdAt: Date.now()
            }).catch(()=>{});
            setRole('fan');
          } else if (v && v.role) {
            setRole(v.role);
          }
        });
      }
    });
    return () => unsub();
  }, []);

  // Load feed (simple newest first)
  useEffect(() => {
    const feedRef = dbRef(rtdb, 'posts');
    const off = onValue(feedRef, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, v]) => ({ id, ...v })).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
      setPosts(arr);
    });
    return () => off();
  }, []);

  // IntersectionObserver per conteggio view dopo 10 secondi di visibilità
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (observers.current) {
      observers.current.disconnect?.();
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute('data-post-id');
        if (!id) return;
        const key = `viewed:${id}`;
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
          // stop timer if any
          if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
          }
          return;
        }
        if (localStorage.getItem(key)) return; // già contato
        if (timers.current[id]) return; // timer già avviato
        timers.current[id] = setTimeout(async () => {
          try {
            localStorage.setItem(key, '1');
            const vref = dbRef(rtdb, `posts/${id}/viewsCount`);
            await runTransaction(vref, (v) => (typeof v === 'number' ? v + 1 : 1));
          } finally {
            delete timers.current[id];
          }
        }, 10000); // 10 secondi
      });
    }, { threshold: [0.6] });
    observers.current = io;
    return () => {
      io.disconnect?.();
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      timers.current = {};
    };
  }, [rtdb]);

  const fns = useMemo(() => getFunctions(), []);
  const moderateText = useMemo(() => httpsCallable(fns, 'moderateText'), [fns]);
  const moderateImage = useMemo(() => httpsCallable(fns, 'moderateImage'), [fns]);
  const spotifyTrackData = useMemo(() => httpsCallable(fns, 'spotifyTrackData'), [fns]);
  const appleTrackData = useMemo(() => httpsCallable(fns, 'appleTrackData'), [fns]);

  useEffect(() => { try { window.scrollTo(0,0); } catch {} }, []);

  async function doLogin(e) {
    e.preventDefault(); setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(e.message || 'Login failed');
    }
  }
  async function doRegister(e) {
    e.preventDefault(); setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      await set(dbRef(rtdb, `users/${uid}`), {
        email: email.trim(),
        role,
        ipiIsni: role === 'artist' ? (ipiIsni || '').trim() : null,
        verified: role === 'artist' ? false : null,
        createdAt: Date.now()
      });
      if (role === 'artist') {
        nav('/creative-profile');
      }
    } catch (e) {
      setError(e.message || 'Registrazione fallita');
    }
  }
  async function doGoogle() {
    setError('');
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const uid = res.user.uid;
      const uref = dbRef(rtdb, `users/${uid}`);
      await update(uref, { email: res.user.email || null, role: role || 'fan' });
      if ((role || 'fan') === 'artist') {
        nav('/creative-profile');
      }
    } catch (e) {
      setError(e.message || 'Accesso Google fallito');
    }
  }
  async function doReset() {
    setError('');
    try { await sendPasswordResetEmail(auth, email.trim()); alert('Email inviata per recupero password'); } catch (e) { setError(e.message || 'Errore invio email'); }
  }
  async function doLogout() {
    await signOut(auth);
  }

  function validateAspect(w, h, wanted) {
    if (wanted === '1:1') return Math.abs(w - h) <= Math.max(2, Math.round(Math.min(w,h) * 0.01));
    // 9:16
    const target = 9/16; const ratio = w/h; return Math.abs(ratio - target) <= 0.03;
  }

  async function handleCreatePost(e) {
    e.preventDefault(); setError('');
    if (!user) { setError('Devi autenticarti'); return; }
    if (!imageFile) { setError('Seleziona una foto'); return; }
    // Check aspect ratio
    const url = URL.createObjectURL(imageFile);
    const img = new Image();
    const ok = await new Promise((resolve) => { img.onload = () => resolve(validateAspect(img.width, img.height, aspect)); img.onerror = () => resolve(false); img.src = url; });
    URL.revokeObjectURL(url);
    if (!ok) { setError('Formato immagine non valido: usa 9:16 o 1:1'); return; }
    // Moderate text
    try {
      const cap = (caption || '').slice(0, 500);
      if (cap) {
        const r = await moderateText({ text: cap });
        if (!r.data?.allow) { setError('Testo non consentito (policy)'); return; }
      }
    } catch { /* fail-open minimal */ }
    // Upload file
    const postKey = push(dbRef(rtdb, 'posts')).key;
    const path = `social/${user.uid}/${postKey}/image_${Date.now()}.jpg`;
    const sref = stRef(storage, path);
    try {
      await uploadBytes(sref, imageFile, { contentType: imageFile.type || 'image/jpeg' });
      const dl = await getDownloadURL(sref);
      // Moderate image
      try {
        const mr = await moderateImage({ storagePath: path });
        if (!mr.data?.allow) {
          await deleteObject(sref).catch(()=>{});
          setError('Immagine bloccata dalla policy');
          return;
        }
      } catch {}
      // Save post in RTDB
      const post = {
        uid: user.uid,
        role: role,
        caption: (caption || '').slice(0, 500),
        mediaType: 'image',
        imageUrl: dl,
        storagePath: path,
        aspect,
        track: trackMeta || null,
        createdAt: Date.now(),
        viewsCount: 0
      };
      await set(dbRef(rtdb, `posts/${postKey}`), post);
      setImageFile(null); setCaption(''); setTrackMeta(null); alert('Post pubblicato!');
    } catch (e) {
      console.error(e); setError('Upload fallito');
    }
  }

  // Deprecated immediate increment; mantenuto per compat ma non utilizzato
  async function incView(id) { return; }

  async function searchSpotify() {
    try {
      const q = musicQuery.trim(); if (!q) return;
      const r = await spotifyTrackData({ track: q });
      if (r.data?.found) setTrackMeta({ source:'spotify', data: r.data.track }); else alert('Nessun risultato Spotify');
    } catch { alert('Errore Spotify'); }
  }
  async function searchApple() {
    try {
      const q = musicQuery.trim(); if (!q) return;
      const r = await appleTrackData({ track: q, storefront: 'it' });
      if (r.data?.found) setTrackMeta({ source:'apple', data: r.data.track }); else alert('Nessun risultato Apple');
    } catch { alert('Errore Apple'); }
  }

  if (loading) {
    return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Caricamento…</div>;
  }

  if (!user) {
    return (
      <div className="publicsite-bg">
        <Link to="/" className="dash-badge">Home</Link>
        <div className="container" style={{ maxWidth: 980, margin: '24px auto' }}>
          <h1 className="publicsite-title" style={{ textAlign:'center' }}>Social Sounds</h1>
          <p className="publicsite-desc" style={{ textAlign:'center' }}>
            Scegli come entrare:
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16, margin:'12px 0' }}>
            <div className="detail-panel" style={{ padding:16 }}>
              <h3 style={{ color:'#fff', marginTop:0 }}>Creativi (Artisti)</h3>
              <p className="publicsite-desc">Crea il tuo <b>Creative Profile</b> (bio, foto, sito, contatti). Pubblica <b>Real Reels</b>, <b>Foto</b>, <b>Post</b>, usa la <b>Suods Chat</b>, crea <b>Eventi/Concerti</b>.</p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" onClick={()=>{ setRole('artist'); setTab('register'); }}>Registrati come Creativo</button>
                <button className="btn btn-ghost" onClick={()=>{ setRole('artist'); setTab('login'); }}>Accedi Creativo</button>
              </div>
            </div>
            <div className="detail-panel" style={{ padding:16 }}>
              <h3 style={{ color:'#fff', marginTop:0 }}>Sounds Fun (Utenti)</h3>
              <p className="publicsite-desc">Guarda tutto e commenta. <b>Nessun like</b>, nessun seguito: conta solo il <b>numero verde</b> dopo 10 secondi di visualizzazione.</p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" onClick={()=>{ setRole('fan'); setTab('login'); }}>Accedi</button>
                <button className="btn btn-ghost" onClick={()=>{ setRole('fan'); setTab('register'); }}>Registrati</button>
              </div>
            </div>
          </div>
          {tab==='login' ? (
            <form onSubmit={doLogin} className="detail-panel" style={{ padding:16 }}>
              <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
              {error ? <div style={{ color:'#f87171', marginTop:8 }}>{error}</div> : null}
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button className="btn btn-primary" type="submit">Accedi</button>
                <button className="btn btn-ghost" type="button" onClick={doGoogle}>Google</button>
                <button className="btn btn-ghost" type="button" onClick={doReset}>Password dimenticata</button>
              </div>
            </form>
          ) : (
            <form onSubmit={doRegister} className="detail-panel" style={{ padding:16 }}>
              <div style={{ display:'flex', gap:12, marginBottom:8 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6 }}><input type="radio" name="role" value="fan" checked={role==='fan'} onChange={()=>setRole('fan')} /> Sounds Fun (Utente)</label>
                <label style={{ display:'flex', alignItems:'center', gap:6 }}><input type="radio" name="role" value="artist" checked={role==='artist'} onChange={()=>setRole('artist')} /> Creativo (Artista)</label>
              </div>
              <label className="field"><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
              <label className="field"><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
              {role==='artist' && (
                <>
                  <label className="field"><span>Codice IPI/ISNI (SIAE/BMI/Soundreef)</span><input type="text" value={ipiIsni} onChange={e=>setIpiIsni(e.target.value)} placeholder="Es. IPI 123456789 / ISNI 0000 0001 2281 955X" /></label>
                  <p className="publicsite-desc">Dopo la registrazione verrai indirizzato al tuo <b>Creative Profile</b> per completare bio, foto e contatti.</p>
                </>
              )}
              {error ? <div style={{ color:'#f87171', marginTop:8 }}>{error}</div> : null}
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <button className="btn btn-primary" type="submit">Crea account</button>
                <button className="btn btn-ghost" type="button" onClick={doGoogle}>Google</button>
              </div>
            </form>
          )}
          <p className="publicsite-desc" style={{ textAlign:'center', marginTop:12 }}>
            Proseguendo confermi di accettare i nostri <a href="/privacy" target="_blank" rel="noreferrer">Termini, Privacy e Policy</a>.
          </p>
        </div>
      </div>
    );
  }

  // Logged in view: create post + feed
  return (
    <div className="publicsite-bg">
      <Link to="/" className="dash-badge">Home</Link>
      <div className="container" style={{ maxWidth: 980, margin: '16px auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <h1 className="publicsite-title">Social Sounds</h1>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {role === 'artist' && (
              <>
                <Link className="btn btn-ghost" to="/creative-profile">Creative Profile</Link>
                <Link className="btn btn-ghost" to="/events">Eventi</Link>
                <Link className="btn btn-ghost" to="/sounds/chat">Suods Chat</Link>
              </>
            )}
            <Link className="btn btn-ghost" to="/sounds/reels">Real Reels</Link>
            <button className="btn btn-ghost" onClick={doLogout}>Esci</button>
          </div>
        </div>
        <p className="publicsite-desc" style={{ marginTop: 4 }}>
          Social senza like o follower: solo visualizzazioni reali (counter verde). Posta foto 9:16 o 1:1. Associa musica da Spotify/Apple. Tutto privato e moderato.
        </p>

        <form onSubmit={handleCreatePost} className="detail-panel" style={{ padding:16, marginTop:12 }}>
          <h3 style={{ color:'#fff', marginTop:0 }}>Crea post (Foto)</h3>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <label className="field" style={{ minWidth:260, flex:'1 1 260px' }}>
              <span did="caption">Testo (max 500)</span>
              <textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={3} />
            </label>
            <label className="field" style={{ minWidth:220 }}>
              <span>Immagine (9:16 o 1:1)</span>
              <input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginTop:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6 }}><input type="radio" name="aspect" value="9:16" checked={aspect==='9:16'} onChange={()=>setAspect('9:16')} /> 9:16</label>
            <label style={{ display:'flex', alignItems:'center', gap:6 }}><input type="radio" name="aspect" value="1:1" checked={aspect==='1:1'} onChange={()=>setAspect('1:1')} /> 1:1</label>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:8, flexWrap:'wrap' }}>
            <input type="text" placeholder="Cerca brano Spotify/Apple" value={musicQuery} onChange={e=>setMusicQuery(e.target.value)} style={{ flex:'1 1 220px' }} />
            <button type="button" className="btn btn-ghost" onClick={searchSpotify}>Cerca Spotify</button>
            <button type="button" className="btn btn-ghost" onClick={searchApple}>Cerca Apple</button>
            {trackMeta && (
              <span style={{ color:'#93c5fd' }}>Selezionato: {trackMeta.data?.name || trackMeta.data?.title || 'Brano'} ({trackMeta.source})</span>
            )}
          </div>
          {error ? <div style={{ color:'#f87171', marginTop:8 }}>{error}</div> : null}
          <div style={{ marginTop:12 }}>
            <button className="btn btn-primary" type="submit">Pubblica</button>
          </div>
        </form>

        <div style={{ marginTop:18 }}>
          <h3 style={{ color:'#fff' }}>Feed</h3>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
            {posts.map(p => (
              <article key={p.id} className="detail-panel" style={{ padding:8 }} data-post-id={p.id} ref={(el)=>{
                if (!el || !observers.current) return;
                try { observers.current.observe(el); } catch {}
              }}>
                {p.mediaType === 'image' && (
                  <img src={p.imageUrl} alt={p.caption?.slice(0,60)||'post'} style={{ width:'100%', height:'auto', borderRadius:8 }} />
                )}
                {p.mediaType === 'reel' && (
                  <video src={p.videoUrl} controls playsInline style={{ width:'100%', borderRadius:8 }} />
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                  <div style={{ color:'#cbd5e1', fontSize:13 }}>{p.caption}</div>
                  <div style={{ color:'#22c55e', textShadow:'0 0 8px rgba(34,197,94,0.7)' }}>👁 {p.viewsCount||0}</div>
                </div>
                {p.track?.data?.name && (
                  <div style={{ color:'#93c5fd', fontSize:12, marginTop:4 }}>
                    🎵 {p.track.data.name}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
