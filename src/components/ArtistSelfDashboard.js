import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Artisti.css';
import { db, storage } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export default function ArtistSelfDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [profileFile, setProfileFile] = useState(null);
  const [profileUrl, setProfileUrl] = useState('');
  const [socials, setSocials] = useState({ instagram: '', youtube: '', spotify: '', apple: '', facebook: '' });
  const [website, setWebsite] = useState('');
  const [spotlight, setSpotlight] = useState([]); // [{title,url}]
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user) return;
      try {
        // Primo tentativo: doc con uid
        let dref = doc(db, 'artisti', user.uid);
        let snap = await getDoc(dref);
        // Se non esiste, prova a cercare un doc diverso che abbia authUid = user.uid
        if (!snap.exists()) {
          // Non abbiamo query server-side semplice senza indicizzazione; fallback: niente.
          // (Opzionale: potremmo caricare tutti e filtrare, ma evitato per costi.)
          // Qui assumiamo che la migrazione salvi authUid nel primo login artistico.
        }
        if (snap.exists()) {
          const data = snap.data();
          if (data.authUid && data.authUid !== user.uid) {
            // Sicurezza: se authUid salvato non coincide, blocca editing
            console.warn('[ArtistSelfDashboard] authUid mismatch, blocco salvataggio');
            setMessage('Il tuo account non è autorizzato a modificare questo profilo. Contatta l\'admin.');
          } else if (!data.authUid) {
            // Aggiorna silenziosamente
            try { await setDoc(dref, { authUid: user.uid }, { merge: true }); } catch(_){}
          }
          setBio(data.bio || '');
          setCoverUrl(data.coverUrl || '');
          setProfileUrl(data.profileUrl || '');
          setSocials({
            instagram: data.socials?.instagram || '',
            youtube: data.socials?.youtube || '',
            spotify: data.socials?.spotify || '',
            apple: data.socials?.apple || '',
            facebook: data.socials?.facebook || ''
          });
          setSpotlight(Array.isArray(data.spotlight) ? data.spotlight.map(it => ({ title: it.title || '', url: it.url || '' })) : []);
          setWebsite(data.website || '');
        } else {
          setMessage('Nessun profilo artista collegato a questo account.');
        }
      } catch (e) {
        console.warn('[ArtistSelfDashboard] load error', e);
        setMessage('Errore caricamento profilo.');
      } finally {
        mounted = false;
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [user]);

  if (!user) return <div style={{padding:24, color:'#ffd700'}}>Devi accedere per gestire il tuo profilo.</div>;
  if (loading) return <div style={{padding:24, color:'#ffd700'}}>Caricamento…</div>;

  const onSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      let newCoverUrl = coverUrl;
      if (coverFile) {
        const r = ref(storage, `artists/${user.uid}/cover.jpg`);
        await uploadBytes(r, coverFile);
        newCoverUrl = await getDownloadURL(r);
      }
      let newProfileUrl = profileUrl;
      if (profileFile) {
        const r = ref(storage, `artists/${user.uid}/profile.jpg`);
        await uploadBytes(r, profileFile);
        newProfileUrl = await getDownloadURL(r);
      }
      const dref = doc(db, 'artisti', user.uid);
      const cleanSpotlight = (Array.isArray(spotlight) ? spotlight : []).filter(it => (it.url||'').trim()).map(it => ({ title: (it.title||'').trim(), url: (it.url||'').trim() }));
      await setDoc(dref, {
        bio: bio || '',
        coverUrl: newCoverUrl || '',
        profileUrl: newProfileUrl || '',
        socials: {
          instagram: (socials.instagram||'').trim(),
          youtube: (socials.youtube||'').trim(),
          spotify: (socials.spotify||'').trim(),
          apple: (socials.apple||'').trim(),
          facebook: (socials.facebook||'').trim(),
        },
        spotlight: cleanSpotlight,
        website: (website || '').trim(),
      }, { merge: true });
      setCoverUrl(newCoverUrl);
      setProfileUrl(newProfileUrl);
      setMessage('Salvato con successo.');
    } catch (e) {
      console.error('[ArtistSelfDashboard] save error', e);
      setMessage('Errore nel salvataggio.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-base">
      <header className="dash-header">
        <h2 className="dash-title">La mia Dashboard</h2>
        <div className="dash-actions">
          <button className="dash-btn dash-btn--ghost" onClick={() => navigate('/')}>Torna al Sito</button>
          <button className="dash-btn dash-btn--primary" onClick={logout}>Logout</button>
        </div>
        <div className="dash-user" title="Firebase UID">{user.email} · UID: {user.uid}</div>
      </header>

      <div style={{maxWidth:820, margin:'20px auto 40px', padding:'0 16px'}}>
        <p>Modifica la bio, carica immagine profilo e cover, aggiungi i tuoi link social e seleziona brani in evidenza. Le modifiche sono salvate subito.</p>

      <label style={{display:'block', marginTop:20, color:'#ddd'}}>Bio</label>
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value)}
        rows={6}
        style={{width:'100%', padding:12, borderRadius:8, border:'1px solid #333', background:'#111', color:'#eee'}}
      />

      <label style={{display:'block', marginTop:20, color:'#ddd'}}>Cover (JPG/PNG)</label>
      <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0]||null)} />
      {coverUrl && (
        <div style={{marginTop:12}}>
          <img alt="cover" src={coverUrl} style={{maxWidth:'100%', borderRadius:8}} />
        </div>
      )}

      <label style={{display:'block', marginTop:20, color:'#ddd'}}>Immagine profilo (JPG/PNG)</label>
      <input type="file" accept="image/*" onChange={e => setProfileFile(e.target.files?.[0]||null)} />
      {profileUrl && (
        <div style={{marginTop:12}}>
          <img alt="profilo" src={profileUrl} style={{maxWidth:240, borderRadius:12}} />
        </div>
      )}

      <div style={{marginTop:24, padding:'12px 12px', border:'1px solid #333', borderRadius:10, background:'#0b0b0b'}}>
        <h3 style={{color:'#ffd700', marginTop:0}}>Link Social</h3>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
          <label style={{color:'#ccc'}}>Instagram URL
            <input type="url" value={socials.instagram} onChange={e=>setSocials(s=>({...s, instagram:e.target.value}))} placeholder="https://instagram.com/..." style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
          <label style={{color:'#ccc'}}>YouTube URL
            <input type="url" value={socials.youtube} onChange={e=>setSocials(s=>({...s, youtube:e.target.value}))} placeholder="https://youtube.com/..." style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
          <label style={{color:'#ccc'}}>Spotify URL
            <input type="url" value={socials.spotify} onChange={e=>setSocials(s=>({...s, spotify:e.target.value}))} placeholder="https://open.spotify.com/..." style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
          <label style={{color:'#ccc'}}>Apple Music URL
            <input type="url" value={socials.apple} onChange={e=>setSocials(s=>({...s, apple:e.target.value}))} placeholder="https://music.apple.com/..." style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
          <label style={{color:'#ccc'}}>Facebook URL
            <input type="url" value={socials.facebook} onChange={e=>setSocials(s=>({...s, facebook:e.target.value}))} placeholder="https://facebook.com/..." style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
          <label style={{color:'#ccc'}}>Sito web
            <input type="url" value={website} onChange={e=>setWebsite(e.target.value)} placeholder="https://esempio.com" style={{width:'100%', padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff', marginTop:6}} />
          </label>
        </div>
      </div>

      <div style={{marginTop:24, padding:'12px 12px', border:'1px solid #333', borderRadius:10, background:'#0b0b0b'}}>
        <h3 style={{color:'#ffd700', marginTop:0}}>Brani in evidenza</h3>
        <p style={{color:'#bbb', marginTop:0}}>Aggiungi i tuoi brani o link (mp3, Spotify, YouTube, ecc.). Inserisci un titolo breve per ciascuno.</p>
        {(spotlight || []).map((it, idx) => (
          <div key={idx} style={{display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'center', marginBottom:8}}>
            <input type="text" value={it.title||''} onChange={e=>setSpotlight(arr=>arr.map((v,i)=>i===idx?{...v,title:e.target.value}:v))} placeholder="Titolo" style={{padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff'}} />
            <input type="url" value={it.url||''} onChange={e=>setSpotlight(arr=>arr.map((v,i)=>i===idx?{...v,url:e.target.value}:v))} placeholder="https://..." style={{padding:10, borderRadius:8, border:'1px solid #333', background:'#111', color:'#fff'}} />
            <button type="button" onClick={()=>setSpotlight(arr=>arr.filter((_,i)=>i!==idx))} style={{padding:'10px 12px', borderRadius:8, background:'#300', color:'#fff', border:'1px solid #511'}}>Rimuovi</button>
          </div>
        ))}
        <div style={{display:'flex', gap:8}}>
          <button type="button" onClick={()=>setSpotlight(arr=>[...(arr||[]), {title:'',url:''}])} style={{padding:'10px 14px', background:'#111', color:'#ffd700', border:'1px solid #444', borderRadius:8, fontWeight:700}}>+ Aggiungi</button>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        style={{marginTop:24, padding:'10px 18px', background:'#ffd700', border:'none', borderRadius:8, cursor:'pointer', color:'#000', fontWeight:600}}
      >{saving ? 'Salvataggio…' : 'Salva'}</button>
        {message && <div style={{marginTop:12, color:'#9fe89f'}}>{message}</div>}
      </div>
    </div>
  );
}
