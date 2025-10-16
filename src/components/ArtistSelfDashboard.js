import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Artisti.css';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import ArtistPageEditable from './ArtistPageEditable';

export default function ArtistSelfDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [artistDoc, setArtistDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [docId, setDocId] = useState(null);

  useEffect(() => {
      let cancelled = false;
      async function load() {
        if (!user) { setLoading(false); return; }
        try {
          // Direct doc by uid
          let targetId = user.uid;
          let dref = doc(db, 'artisti', targetId);
          let snap = await getDoc(dref);
          if (!snap.exists()) {
            // Query by authUid mapping
            const q = query(collection(db, 'artisti'), where('authUid', '==', user.uid), limit(1));
            const qs = await getDocs(q);
            if (!qs.empty) {
              const found = qs.docs[0];
              snap = found; // treat found as snapshot
              dref = doc(db, 'artisti', found.id);
              targetId = found.id;
              setNotice('Profilo trovato tramite collegamento account (authUid).');
            } else {
              // Fallback 2: match by loginEmail == user.email
              const q2 = query(collection(db, 'artisti'), where('loginEmail', '==', (user.email || '').toLowerCase()), limit(1));
              const qs2 = await getDocs(q2);
              if (!qs2.empty) {
                const found2 = qs2.docs[0];
                snap = found2;
                dref = doc(db, 'artisti', found2.id);
                targetId = found2.id;
                setNotice('Profilo trovato via email. Creo il collegamento…');
              } else {
                // Fallback 3: some docs may store generic 'email'
                const q3 = query(collection(db, 'artisti'), where('email', '==', (user.email || '').toLowerCase()), limit(1));
                const qs3 = await getDocs(q3);
                if (!qs3.empty) {
                  const found3 = qs3.docs[0];
                  snap = found3;
                  dref = doc(db, 'artisti', found3.id);
                  targetId = found3.id;
                  setNotice('Profilo trovato via email (campo generico). Creo il collegamento…');
                }
              }
            }
          }
          if (snap.exists()) {
            const data = snap.data();
            if (data.authUid && data.authUid !== user.uid) {
              setMessage('Il tuo account non è autorizzato a modificare questo profilo. Contatta l\'admin.');
            } else if (!data.authUid) {
              try { await setDoc(dref, { authUid: user.uid }, { merge: true }); setNotice(n => n || 'Collegamento creato tra il tuo account e il profilo artista.'); } catch(_){ }
            }
            if (!cancelled) {
              setArtistDoc({ id: targetId, ...data });
              setDocId(targetId);
            }
          } else if (!cancelled) {
            setMessage('Nessun profilo artista collegato a questo account.');
          }
        } catch(e) {
          console.warn('[ArtistSelfDashboard] load error', e);
          if (!cancelled) setMessage('Errore caricamento profilo.');
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      load();
      return () => { cancelled = true; };
  }, [user]);

  async function handleSave(payload) {
    if (!docId) { setMessage('Profilo non trovato per il salvataggio.'); return; }
    const dataToWrite = { ...payload, authUid: user.uid };
    try {
      // Primo tentativo: scrivi nel doc risolto (potrebbe essere != uid)
      await setDoc(doc(db, 'artisti', docId), dataToWrite, { merge: true });
      setArtistDoc(a => ({ ...(a||{}), ...payload }));
      setMessage('Salvato con successo.');
    } catch(e) {
      console.error('[ArtistSelfDashboard] handleSave primary error', e);
      // Fallback: se permesso negato, prova a scrivere nel doc del tuo UID
      try {
        const safeMerged = { ...(artistDoc || {}), ...payload, authUid: user.uid };
        // Rimuovi metadati non desiderati
        delete safeMerged.id;
        await setDoc(doc(db, 'artisti', user.uid), safeMerged, { merge: true });
        setArtistDoc(a => ({ ...(a||{}), ...payload }));
        setMessage('Salvato con successo. (Profilo migrato sul tuo account)');
      } catch(e2) {
        console.error('[ArtistSelfDashboard] handleSave fallback(uid) error', e2);
        const msg = (e2 && (e2.message || e2.code)) || (e && (e.message || e.code)) || 'Errore nel salvataggio.';
        setMessage(msg.includes('permission') ? 'Permesso negato. Contatta l\'admin.' : 'Errore nel salvataggio.');
      }
    }
  }

  if (!user) return <div style={{padding:24, color:'#ffd700'}}>Devi accedere per gestire il tuo profilo.</div>;
  if (loading) return <div style={{padding:24, color:'#ffd700'}}>Caricamento…</div>;

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
      {/* Notice banner */}
      {notice && (
        <div style={{ position:'sticky', top:0, zIndex:100, margin:'10px auto 0', maxWidth:1100, padding:'10px 12px', borderRadius:10, background:'rgba(17,68,23,0.65)', border:'1px solid #1f8f3a', color:'#d8ffe3' }}>
          {notice}
          <button onClick={() => setNotice('')} style={{ float:'right', background:'transparent', border:'none', color:'#d8ffe3', cursor:'pointer' }} aria-label="Chiudi">×</button>
        </div>
      )}
        <div style={{maxWidth:1100, margin:'20px auto 60px', padding:'0 16px'}}>
          {!artistDoc && (
            <div style={{color:'#ffd700', marginTop:24}}>{message || 'Nessun profilo artista.'}</div>
          )}
          {artistDoc && (
            <ArtistPageEditable
              artist={artistDoc}
              onSave={(updated) => handleSave(updated)}
              hideSteps={true}
              hideStripePaymentLink={true}
              restrictToBioAndPhoto={true}
            />
          )}
          {message && artistDoc && <div style={{marginTop:12, color:'#9fe89f'}}>{message}</div>}
        </div>
      </div>
  );
}
