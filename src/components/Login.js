import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { ADMIN_UIDS } from './config';

export default function Login() {
  const { login, signup, user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect spostato in useEffect per evitare loop di rendering
  useEffect(() => {
    if (!loading && user) {
      if (ADMIN_UIDS.includes(user.uid)) {
        console.info('[Login] Utente admin autenticato, redirect /dashboard');
        navigate('/dashboard');
      } else {
        console.info('[Login] Utente artista autenticato, redirect /artist-dashboard');
        navigate('/artist-dashboard');
      }
    }
  }, [user, loading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signup(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
  // Il redirect viene gestito nel useEffect in base a user/admin
    } catch (err) {
      setError(err.message || 'Errore autenticazione');
    } finally {
      setSubmitting(false);
    }
  }

  const [showPass, setShowPass] = useState(false);

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
        <h2 className="login-title">{mode === 'login' ? 'Accedi' : 'Registrati'}</h2>
        {user && !ADMIN_UIDS.includes(user.uid) && (
          <div className="login-info" style={{ background: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: 8, marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>Sei autenticato come artista. Verrai reindirizzato alla tua Dashboard personale.</div>
            <button type="button" onClick={() => navigate('/artist-dashboard')} className="login-mode-btn" style={{ width: '100%' }}>Apri la mia Dashboard</button>
          </div>
        )}
        <div className="login-mode-switch">
          <button type="button" onClick={() => setMode('login')} className={"login-mode-btn" + (mode === 'login' ? ' active' : '')}>Login</button>
            <button type="button" onClick={() => setMode('signup')} className={"login-mode-btn" + (mode === 'signup' ? ' active' : '')}>Registrati</button>
        </div>
        <label className="login-label">Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="login-input" />
        <label className="login-label login-password-label">Password
          <span className="login-hint">{password.length >= 6 ? '' : 'min 6 caratteri'}</span>
        </label>
        <div className="login-password-wrapper">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="login-input login-password-input"
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            aria-label={showPass ? 'Nascondi password' : 'Mostra password'}
            className="login-eye-btn"
            data-active={showPass ? 'true' : 'false'}
          >
            {showPass ? (
              // Icona occhio barrato
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M3 3l18 18" strokeLinecap="round"/>
                <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42M9.88 5.54A9.77 9.77 0 0 1 12 5c5.52 0 9 5.5 9 7-.24.9-1.03 2.24-2.34 3.55M6.35 6.35C4.32 7.64 3.24 9.46 3 12c0 1.5 3.48 7 9 7 1.38 0 2.66-.26 3.82-.76" strokeLinecap="round"/>
              </svg>
            ) : (
              // Icona occhio aperto
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M1 12s3.5-7 11-7 11 7 11 7-3.5 7-11 7S1 12 1 12Z" />
                <circle cx="12" cy="12" r="3.2" />
              </svg>
            )}
          </button>
        </div>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={submitting} className="login-submit">{submitting ? 'Attendere...' : (mode === 'login' ? 'Entra' : 'Crea Account')}</button>
      </form>
    </div>
  );
}
