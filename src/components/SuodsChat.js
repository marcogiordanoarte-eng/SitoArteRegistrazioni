import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, rtdb } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ref as dbRef, onValue, push, set, serverTimestamp } from 'firebase/database';

export default function SuodsChat() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState('fan');
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setLoading(false);
      if (u) {
        onValue(dbRef(rtdb, `users/${u.uid}`), (snap) => {
          const v = snap.val() || {};
          setRole(v.role || 'fan');
        }, { onlyOnce: true });
        const mref = dbRef(rtdb, 'chats/creatives');
        onValue(mref, (snap) => {
          const val = snap.val() || {};
          const arr = Object.entries(val).map(([id, v]) => ({ id, ...v })).sort((a,b)=> (a.ts||0)-(b.ts||0));
          setMessages(arr.slice(-200));
        });
      }
    });
    return () => unsub();
  }, []);

  async function send(e) {
    e.preventDefault();
    if (!user || role !== 'artist') return;
    const t = (text || '').trim(); if (!t) return;
    const mref = push(dbRef(rtdb, 'chats/creatives'));
    await set(mref, {
      uid: user.uid,
      email: user.email || null,
      text: t.slice(0, 2000),
      ts: Date.now()
    });
    setText('');
  }

  if (loading) return <div style={{ color:'#ffd700', textAlign:'center', marginTop:80 }}>Caricamento…</div>;
  if (!user) return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">Accedi per usare la Suods Chat.</p><Link className="btn btn-primary" to="/sounds">Vai al login</Link></div></div>;
  if (role !== 'artist') return <div className="publicsite-bg"><div className="container" style={{ maxWidth: 900, margin:'24px auto' }}><p className="publicsite-desc">La Suods Chat è riservata ai Creativi (Artisti).</p><Link className="btn btn-ghost" to="/sounds">Torna a Social Sounds</Link></div></div>;

  return (
    <div className="publicsite-bg">
      <Link to="/sounds" className="dash-badge">Social</Link>
      <div className="container" style={{ maxWidth: 900, margin:'16px auto' }}>
        <h1 className="publicsite-title">Suods Chat</h1>
        <div className="detail-panel" style={{ padding:16, maxHeight: '50vh', overflowY:'auto' }}>
          {messages.map(m => (
            <div key={m.id} style={{ marginBottom:8 }}>
              <div style={{ color:'#93c5fd', fontSize:12 }}>{m.email || m.uid}</div>
              <div style={{ color:'#e5e7eb' }}>{m.text}</div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="detail-panel" style={{ padding:16, marginTop:8 }}>
          <div style={{ display:'flex', gap:8 }}>
            <input type="text" value={text} onChange={e=>setText(e.target.value)} placeholder="Scrivi un messaggio" style={{ flex:1 }} />
            <button className="btn btn-primary" type="submit">Invia</button>
          </div>
        </form>
      </div>
    </div>
  );
}
