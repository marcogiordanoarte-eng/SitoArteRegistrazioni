import React, { useEffect, useMemo, useState } from 'react';
import { rtdb } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref as dbRef, onValue, update } from 'firebase/database';

// Admin: verifica artisti registrati su RTDB (users/{uid})
// Mostra solo utenti con role==='artist' e ipiIsni presente; consente toggle verified
export default function SocialVerifyArtists() {
  const [allUsers, setAllUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyUid, setBusyUid] = useState('');
  const fns = useMemo(() => getFunctions(), []);
  const approveArtist = useMemo(() => httpsCallable(fns, 'approveArtistRequest'), [fns]);

  useEffect(() => {
    const uref = dbRef(rtdb, 'users');
    const off = onValue(uref, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([uid, u]) => ({ uid, ...u }));
      setAllUsers(arr);
      setLoading(false);
    }, (err) => {
      setError(err?.message || 'Errore lettura utenti');
      setLoading(false);
    });
    return () => off();
  }, []);

  const artists = useMemo(() => {
    const list = allUsers.filter(u => (u.role === 'artist') && !!(u.ipiIsni && String(u.ipiIsni).trim()));
    const query = (q || '').toLowerCase();
    const filtered = query ? list.filter(u => {
      const email = (u.email || '').toLowerCase();
      const ipi = (u.ipiIsni || '').toLowerCase();
      const name = (u.displayName || u.name || '').toLowerCase();
      const uid = (u.uid || u.id || '').toLowerCase();
      return email.includes(query) || ipi.includes(query) || name.includes(query) || uid.includes(query);
    }) : list;
    // Ordina: prima non verificati, poi per createdAt desc
    return filtered.sort((a, b) => {
      const av = a.verified === true ? 1 : 0;
      const bv = b.verified === true ? 1 : 0;
      if (av !== bv) return av - bv; // 0 (unverified) prima di 1 (verified)
      const ad = Number(a.createdAt || 0);
      const bd = Number(b.createdAt || 0);
      return bd - ad;
    });
  }, [allUsers, q]);

  async function setVerified(uid, value) {
    try {
      await update(dbRef(rtdb, `users/${uid}`), { verified: !!value });
    } catch (e) {
      alert('Errore aggiornamento verifica: ' + (e?.message || e));
    }
  }

  async function handleCheckApprove(u) {
    if (!u || !u.uid) return;
    if (!u.ipiIsni) { alert('Manca IPI/ISNI'); return; }
    try {
      setBusyUid(u.uid);
      const res = await approveArtist({ uid: u.uid, ipiIsni: String(u.ipiIsni), email: u.email || null, displayName: u.displayName || u.name || null });
      if (res?.data?.ok) {
        // Reflect locally (optional; server already updated)
        try { await update(dbRef(rtdb, `users/${u.uid}`), { verified: true, isArtist: true }); } catch {}
        alert('Artista approvato e verificato');
      } else {
        alert('Verifica non riuscita');
      }
    } catch (e) {
      alert('Errore approvazione: ' + (e?.message || e));
    } finally {
      setBusyUid('');
    }
  }

  function fmt(ts) {
    const n = Number(ts || 0);
    if (!n) return '—';
    try { return new Date(n).toLocaleString(); } catch { return '—'; }
  }

  return (
    <div className="dash-container" style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <h3 className="dash-section-title" style={{ margin: 0 }}>Verifica Artisti (Social Sounds)</h3>
        <input
          type="search"
          placeholder="Cerca email / nome / IPI/ISNI / UID"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{ flex:'1 1 260px', minWidth:260, padding:8, borderRadius:8, border:'1px solid #444', background:'#0b0b0b', color:'#fff' }}
        />
      </div>
      {loading && <div style={{ color:'#bbb' }}>Caricamento…</div>}
      {error && <div style={{ color:'#ff6464' }}>{error}</div>}
      {!loading && !error && (
        artists.length === 0 ? (
          <div style={{ color:'#888' }}>Nessun artista da verificare.</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #333', textAlign:'left', color:'#ffd700' }}>
                <th style={{ padding:'8px 6px' }}>Email</th>
                <th style={{ padding:'8px 6px' }}>IPI/ISNI</th>
                <th style={{ padding:'8px 6px' }}>UID</th>
                <th style={{ padding:'8px 6px' }}>Creato</th>
                <th style={{ padding:'8px 6px' }}>Stato</th>
                <th style={{ padding:'8px 6px' }}></th>
                <th style={{ padding:'8px 6px' }}></th>
              </tr>
            </thead>
            <tbody>
              {artists.map(u => (
                <tr key={u.uid} style={{ borderBottom:'1px solid #222' }}>
                  <td style={{ padding:'8px 6px' }}>{u.email || '—'}</td>
                  <td style={{ padding:'8px 6px', color:'#cbd5e1' }}>{u.ipiIsni || '—'}</td>
                  <td style={{ padding:'8px 6px', fontSize:12, color:'#888' }}>{u.uid}</td>
                  <td style={{ padding:'8px 6px', fontSize:12, color:'#bbb' }}>{fmt(u.createdAt)}</td>
                  <td style={{ padding:'8px 6px' }}>
                    {u.verified ? (
                      <span style={{ color:'#6fda8b' }}>Verificato</span>
                    ) : (
                      <span style={{ color:'#fbbf24' }}>Da verificare</span>
                    )}
                  </td>
                  <td style={{ padding:'8px 6px' }}>
                    {u.verified ? (
                      <button className="dash-small-btn" onClick={()=>setVerified(u.uid, false)}>Rimuovi verifica</button>
                    ) : (
                      <button className="dash-small-btn dash-small-btn--primary" onClick={()=>setVerified(u.uid, true)}>Verifica</button>
                    )}
                  </td>
                  <td style={{ padding:'8px 6px' }}>
                    {!u.verified && (
                      <button
                        className="dash-small-btn"
                        disabled={busyUid === u.uid || !u.ipiIsni}
                        onClick={() => handleCheckApprove(u)}
                        title={!u.ipiIsni ? 'Inserire IPI/ISNI prima' : 'Controlla formato e approva'}
                      >
                        {busyUid === u.uid ? 'Controllo…' : 'Check/Approva'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
