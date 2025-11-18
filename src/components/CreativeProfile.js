import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, rtdb, storage } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as dbRef, onValue, set, update } from 'firebase/database';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function CreativeProfile() {
  const nav = useNavigate();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('fan');
  const [loading, setLoading] = useState(true);
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
      if (u) {
        const uref = dbRef(rtdb, `users/${u.uid}`);
        onValue(uref, (snap) => {
          const v = snap.val() || {};
          setRole(v.role || 'fan');
        }, { onlyOnce: true });
        const pref = dbRef(rtdb, `profiles/${u.uid}`);
        onValue(pref, (snap) => {
          const p = snap.val() || {};
          setBio(p.bio || '');
          setWebsite(p.website || '');
          setPhone(p.phone || '');
          setAddress(p.address || '');
          setImageUrl(p.imageUrl || '');
        });
      }
    });
    return () => unsub();
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setError(''); setSaved(false);
    if (!user) { setError('Devi autenticarti'); return; }
    try {
      let url = imageUrl;
      if (imageFile) {
        const path = `profiles/${user.uid}/profile_${Date.now()}.jpg`;
        const sref = stRef(storage, path);
        await uploadBytes(sref, imageFile, { contentType: imageFile.type || 'image/jpeg' });
        url = await getDownloadURL(sref);
      }
      await set(dbRef(rtdb, `profiles/${user.uid}`), {
        bio: (bio || '').slice(0, 2000),
        website: (website || '').slice(0, 200),
        phone: (phone || '').slice(0, 60),
        address: (address || '').slice(0, 200),
        imageUrl: url || ''
      });
      setImageUrl(url);
      setSaved(true);
    } catch (e) {
      setError('Salvataggio profilo fallito');
    }
  }

  if (loading) return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Caricamento…</div>;
  if (!user) return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">Devi accedere per modificare il tuo Creative Profile.</p><Link className="btn btn-primary" to="/sounds">Vai al login</Link></div></div>;
  if (role !== 'artist') return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">Questa sezione è riservata ai Creativi (Artisti).</p><Link className="btn btn-ghost" to="/sounds">Torna a Social Sounds</Link></div></div>;

  return (
    <div className="publicsite-bg">
      <Link to="/sounds" className="dash-badge">Social</Link>
      <div className="container" style={{ maxWidth: 900, margin: '16px auto' }}>
        <h1 className="publicsite-title">Creative Profile</h1>
        <form onSubmit={saveProfile} className="detail-panel" style={{ padding:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:12 }}>
            <label className="field"><span>Biografia</span><textarea rows={6} value={bio} onChange={e=>setBio(e.target.value)} /></label>
            <label className="field"><span>Sito professionale</span><input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://…" /></label>
            <label className="field"><span>Telefono</span><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+39 …" /></label>
            <label className="field"><span>Indirizzo</span><input type="text" value={address} onChange={e=>setAddress(e.target.value)} placeholder="Via, Città, Paese" /></label>
            <label className="field"><span>Foto profilo</span><input type="file" accept="image/*" onChange={e=>setImageFile(e.target.files?.[0]||null)} /></label>
            {imageUrl ? <img src={imageUrl} alt="profile" style={{ width:180, height:'auto', borderRadius:12 }} /> : null}
          </div>
          {error ? <div style={{ color:'#f87171', marginTop:8 }}>{error}</div> : null}
          {saved ? <div style={{ color:'#22c55e', marginTop:8 }}>Salvato!</div> : null}
          <div style={{ marginTop:12, display:'flex', gap:8 }}>
            <button className="btn btn-primary" type="submit">Salva</button>
            <Link className="btn btn-ghost" to="/sounds/reels">Vai a Real Reels</Link>
            <Link className="btn btn-ghost" to="/events">Eventi</Link>
            <Link className="btn btn-ghost" to="/sounds/chat">Suods Chat</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
