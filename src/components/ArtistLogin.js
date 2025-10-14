import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function ArtistLogin() {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const query = useQuery();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
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
      // Optional: enforce URL aid binding
      if (expectedAid && uid !== expectedAid) {
        await logout();
        throw new Error('Questo accesso è legato ad un artista diverso. Verifica il link ricevuto.');
      }
      const snap = await getDoc(doc(db, 'artisti', uid));
      if (!snap.exists()) {
        await logout();
        throw new Error('Profilo artista non trovato.');
      }
      const data = snap.data() || {};
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
        <button type="submit" disabled={submitting} className="login-submit" style={{marginTop:14}}>
          {submitting ? 'Verifica…' : 'Entra'}
        </button>
      </form>
    </div>
  );
}
