import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

// Admin panel per monitorare login/utenti Social Sounds (struttura iniziale)
// Firestore collections ipotetiche: socialUsers, socialSessions (da creare lato backend quando sarà attivo Social)
// Se le collezioni non esistono, mostriamo stato vuoto.

export default function SocialSoundsAdmin() {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [errors, setErrors] = useState({ users: null, sessions: null });

  useEffect(() => {
    const uq = query(collection(db, 'socialUsers')); // aggiungere orderBy se necessario
    const unsubUsers = onSnapshot(uq, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(list);
    }, err => setErrors(e => ({ ...e, users: err.message || 'Errore lettura utenti social' })));
    return () => unsubUsers();
  }, []);

  useEffect(() => {
    const sq = query(collection(db, 'socialSessions'), orderBy('ts', 'desc'), limit(50));
    const unsubSessions = onSnapshot(sq, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSessions(list);
    }, err => setErrors(e => ({ ...e, sessions: err.message || 'Errore lettura sessioni' })));
    return () => unsubSessions();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ padding: 16, border: '1px solid #333', borderRadius: 12, background: '#111' }}>
        <h4 style={{ margin: 0, color: '#ffd700' }}>Utenti Social Sounds</h4>
        {errors.users && <div style={{ color: '#ff6464', marginTop: 8 }}>{errors.users}</div>}
        {users.length === 0 && !errors.users ? (
          <div style={{ color: '#888', marginTop: 8 }}>Nessun utente (creare collezione 'socialUsers' o nessun iscritto ancora).</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 8 }}>
            {users.map(u => (
              <li key={u.id} style={{ padding: '10px 12px', background: '#000', border: '1px solid #222', borderRadius: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600 }}>{u.displayName || u.name || '(senza nome)'}</div>
                  {u.email && <div style={{ fontSize: 12, color: '#bbb' }}>{u.email}</div>}
                  <div style={{ fontSize: 11, color: '#555' }}>UID: {u.uid || u.id}</div>
                  {u.createdAt && <div style={{ fontSize: 11, color: '#666' }}>Creato: {formatTs(u.createdAt)}</div>}
                  {u.lastActive && <div style={{ fontSize: 11, color: '#666' }}>Ultimo accesso: {formatTs(u.lastActive)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div style={{ padding: 16, border: '1px solid #333', borderRadius: 12, background: '#111' }}>
        <h4 style={{ margin: 0, color: '#ffd700' }}>Ultime Sessioni (max 50)</h4>
        {errors.sessions && <div style={{ color: '#ff6464', marginTop: 8 }}>{errors.sessions}</div>}
        {sessions.length === 0 && !errors.sessions ? (
          <div style={{ color: '#888', marginTop: 8 }}>Nessuna sessione trovata (creare collezione 'socialSessions' o nessun login registrato).</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12, fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #333' }}>
                <th style={{ padding: '6px 4px' }}>Utente</th>
                <th style={{ padding: '6px 4px' }}>IP</th>
                <th style={{ padding: '6px 4px' }}>User-Agent</th>
                <th style={{ padding: '6px 4px' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: '6px 4px' }}>{s.uid || s.userId || '—'}</td>
                  <td style={{ padding: '6px 4px', color: '#bbb' }}>{s.ip || '—'}</td>
                  <td style={{ padding: '6px 4px', color: '#888', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.ua || s.userAgent || '—'}</td>
                  <td style={{ padding: '6px 4px', color: '#ddd' }}>{formatTs(s.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function formatTs(ts) {
  try {
    if (!ts) return '—';
    // Firestore Timestamp support
    if (ts.seconds) {
      const d = new Date(ts.seconds * 1000);
      return d.toLocaleString();
    }
    // ISO string
    if (typeof ts === 'string' && ts.match(/\d{4}-\d{2}-\d{2}/)) {
      const d = new Date(ts);
      return d.toLocaleString();
    }
    // millis
    if (typeof ts === 'number') {
      return new Date(ts).toLocaleString();
    }
    return '—';
  } catch {
    return '—';
  }
}
