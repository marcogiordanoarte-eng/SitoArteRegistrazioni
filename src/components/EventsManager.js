import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, rtdb } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as dbRef, push, set, onValue, remove } from 'firebase/database';

export default function EventsManager() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('fan');
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [desc, setDesc] = useState('');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
      if (u) {
        onValue(dbRef(rtdb, `users/${u.uid}`), (snap) => {
          const v = snap.val() || {};
          setRole(v.role || 'fan');
        }, { onlyOnce: true });
        onValue(dbRef(rtdb, `events/${u.uid}`), (snap) => {
          const val = snap.val() || {};
          const arr = Object.entries(val).map(([id, v]) => ({ id, ...v })).sort((a,b)=> (a.date||'').localeCompare(b.date||''));
          setEvents(arr);
        });
      }
    });
    return () => unsub();
  }, []);

  async function addEvent(e) {
    e.preventDefault();
    if (!user || role !== 'artist') return;
    const evRef = push(dbRef(rtdb, `events/${user.uid}`));
    await set(evRef, {
      title: (title||'').slice(0,120),
      date: (date||'').slice(0,40),
      city: (city||'').slice(0,80),
      venue: (venue||'').slice(0,120),
      desc: (desc||'').slice(0,800),
      createdAt: Date.now()
    });
    setTitle(''); setDate(''); setCity(''); setVenue(''); setDesc('');
  }

  async function delEvent(id) {
    if (!user) return;
    await remove(dbRef(rtdb, `events/${user.uid}/${id}`));
  }

  if (loading) return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Caricamento…</div>;
  if (!user) return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">Accedi per gestire i tuoi Eventi.</p><Link className="btn btn-primary" to="/sounds">Vai al login</Link></div></div>;
  if (role !== 'artist') return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">Questa sezione è riservata ai Creativi (Artisti).</p><Link className="btn btn-ghost" to="/sounds">Torna a Social Sounds</Link></div></div>;

  return (
    <div className="publicsite-bg">
      <Link to="/sounds" className="dash-badge">Social</Link>
      <div className="container" style={{ maxWidth: 900, margin:'16px auto' }}>
        <h1 className="publicsite-title">Eventi / Concerti</h1>
        <form onSubmit={addEvent} className="detail-panel" style={{ padding:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <label className="field" style={{ gridColumn:'1 / -1' }}><span>Titolo</span><input type="text" value={title} onChange={e=>setTitle(e.target.value)} required /></label>
            <label className="field"><span>Data</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
            <label className="field"><span>Città</span><input type="text" value={city} onChange={e=>setCity(e.target.value)} /></label>
            <label className="field" style={{ gridColumn:'1 / -1' }}><span>Luogo</span><input type="text" value={venue} onChange={e=>setVenue(e.target.value)} /></label>
            <label className="field" style={{ gridColumn:'1 / -1' }}><span>Descrizione</span><textarea rows={4} value={desc} onChange={e=>setDesc(e.target.value)} /></label>
          </div>
          <div style={{ marginTop:12 }}>
            <button className="btn btn-primary" type="submit">Aggiungi evento</button>
          </div>
        </form>

        <div style={{ marginTop:12 }}>
          <h3 style={{ color:'#fff' }}>I tuoi eventi</h3>
          <div className="detail-panel" style={{ padding:16 }}>
            {events.length === 0 ? <div className="publicsite-desc">Nessun evento ancora.</div> : (
              events.map(ev => (
                <div key={ev.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.1)', padding:'8px 0', display:'flex', justifyContent:'space-between', gap:8, alignItems:'center' }}>
                  <div>
                    <div style={{ color:'#e5e7eb', fontWeight:600 }}>{ev.title}</div>
                    <div style={{ color:'#93c5fd', fontSize:12 }}>{ev.date || ''}{ev.city?` • ${ev.city}`:''}{ev.venue?` • ${ev.venue}`:''}</div>
                    {ev.desc ? <div style={{ color:'#cbd5e1', fontSize:13 }}>{ev.desc}</div> : null}
                  </div>
                  <button className="btn btn-ghost" onClick={()=>delEvent(ev.id)}>Elimina</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
