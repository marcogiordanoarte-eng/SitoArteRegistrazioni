import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, auth } from './firebase';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function ArtistLogin() {
  const { login, logout, user, resetPassword } = useAuth();
  const [resetRequested, setResetRequested] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const navigate = useNavigate();
  const query = useQuery();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [resetChecking, setResetChecking] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const expectedAid = query.get('aid') || '';

  useEffect(() => {
    // If already logged, we still require code match to continue
    // No auto-redirect here to avoid skipping code step
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cred = await login(email.trim(), password);
      const uid = (cred && cred.user && cred.user.uid) || (user && user.uid);
      if (!uid) throw new Error('Autenticazione non riuscita');
      // Determina quale documento artista usare: prima aid dalla URL, altrimenti prova uid
      let artistDocId = expectedAid || uid;
      let snap = await getDoc(doc(db, 'artisti', artistDocId));
      // Se non trovato e aid diverso dall'uid, prova fallback uid (vecchio schema)
      if (!snap.exists() && expectedAid && expectedAid !== uid) {
        const snapUid = await getDoc(doc(db, 'artisti', uid));
        if (snapUid.exists()) { snap = snapUid; artistDocId = uid; }
      }
      if (!snap.exists()) {
        await logout();
        throw new Error('Profilo artista non trovato. Contatta l\'admin.');
      }
      const data = snap.data() || {};
      // Migrazione: se manca authUid nel doc o è diverso, aggiorna (best effort)
      if (!data.authUid || data.authUid !== uid) {
        try { await setDoc(doc(db, 'artisti', artistDocId), { authUid: uid }, { merge: true }); } catch(_){}
      }
      // Se il doc ha loginEmail e non coincide con email inserita, blocca
      if (data.loginEmail && data.loginEmail.toLowerCase() !== email.trim().toLowerCase()) {
        await logout();
        throw new Error('Email non associata a questo artista.');
      }
      const validCode = (data.loginCode || '').toString().trim();
      if (!code.trim() || !validCode || code.trim() !== validCode) {
        await logout();
        throw new Error('Codice univoco non valido.');
      }
      navigate('/artist-dashboard');
    } catch (err) {
      setError(err.message || 'Errore di accesso');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page-root">
      <div className="login-bg-image" />
      <div className="login-bg-overlay" />
      <div className="login-logo-stack">
        <div className="login-logo-wrapper">
          <img src="/disco.png" alt="Disco" className="login-disco" />
          <img src="/logo.png" alt="Logo" className="login-main-logo" />
        </div>
      </div>
  <form onSubmit={handleSubmit} className="login-form">
        <h2 className="login-title">Dashboard Artista</h2>
        <div className="login-hint" style={{marginBottom:12, color:'#bbb'}}>Inserisci email, password e il codice ricevuto</div>
        <label className="login-label">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="login-input" />
        <label className="login-label">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="login-input" />
        <label className="login-label">Codice univoco</label>
        <input type="text" value={code} onChange={e => setCode(e.target.value)} required className="login-input" placeholder="Es. AR-7F29-KQ" />
        {error && <div className="login-error" style={{marginTop:10}}>{error}</div>}
        {resetMsg && <div style={{marginTop:10, color:'#6fda8b', fontSize:13}}>{resetMsg}</div>}
        <button type="submit" disabled={submitting} className="login-submit" style={{marginTop:14}}>
          {submitting ? 'Verifica…' : 'Entra'}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!email.trim()) { setError('Inserisci prima la tua email.'); return; }
            setDebugInfo('');
            try {
              setError(null);
              setResetMsg('Verifica esistenza account...');
              setResetChecking(true);
              const methods = await fetchSignInMethodsForEmail(auth, email.trim());
              setDebugInfo('Metodi trovati: ' + JSON.stringify(methods));
              if (!methods || methods.length === 0) {
                setResetMsg('Nessun account registrato con questa email. Controlla di averla scritta correttamente.');
                setResetChecking(false);
                return;
              }
              setResetMsg('Invio email di reset...');
              await resetPassword(email.trim());
              setResetMsg('Email inviata. Se non la vedi entro pochi minuti controlla spam/promozioni.');
            } catch (e) {
              setError(e.message || 'Errore invio email reset');
            } finally {
              setResetChecking(false);
            }
          }}
          disabled={resetChecking}
          style={{ marginTop: 10, background: 'transparent', border:'none', color: resetChecking ? '#888' : '#ffd700', textDecoration:'underline', cursor:'pointer', fontSize:13 }}
        >{resetChecking ? 'Attendere…' : 'Recupera / Reset password'}</button>
        {debugInfo && <div style={{marginTop:6, fontSize:10, color:'#555'}}>{debugInfo}</div>}
      </form>
    </div>
  );
}
