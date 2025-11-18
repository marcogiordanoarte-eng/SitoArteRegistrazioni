import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { db, auth, storage, functions } from './firebase';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { ref as stRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

function useQuery() {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
}

export default function ArtistLogin() {
  const { login, logout, user, resetPassword } = useAuth();
  const [resetMsg, setResetMsg] = useState('');
  const navigate = useNavigate();
  const query = useQuery();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ipiCode, setIpiCode] = useState('');
  const [isniCode, setIsniCode] = useState('');
  const [singleCode, setSingleCode] = useState('');
  const [error, setError] = useState(null);
  const [resetChecking, setResetChecking] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const expectedAid = query.get('aid') || '';
  const [showPass, setShowPass] = useState(false);
  const [tab, setTab] = useState('code'); // 'code' | 'audition'
  const [audName, setAudName] = useState('');
  const [audEmail, setAudEmail] = useState('');
  const [audLinkSpotify, setAudLinkSpotify] = useState('');
  const [audLinkApple, setAudLinkApple] = useState('');
  const [audFile, setAudFile] = useState(null);
  const [audStatus, setAudStatus] = useState('');
  const [audSubmitting, setAudSubmitting] = useState(false);

  useEffect(() => {
    // No auto redirect; must validate codes.
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const cred = await login(email.trim(), password);
      const uid = (cred && cred.user && cred.user.uid) || (user && user.uid);
      if (!uid) throw new Error('Autenticazione non riuscita');
      let artistDocId = expectedAid || uid;
      let snap = await getDoc(doc(db, 'artisti', artistDocId));
      if (!snap.exists() && expectedAid && expectedAid !== uid) {
        const snapUid = await getDoc(doc(db, 'artisti', uid));
        if (snapUid.exists()) { snap = snapUid; artistDocId = uid; }
      }
      if (!snap.exists()) {
        await logout();
        throw new Error('Profilo artista non trovato. Contatta l' + 'admin.');
      }
      const data = snap.data() || {};
      if (!data.authUid || data.authUid !== uid) {
        try { await setDoc(doc(db, 'artisti', artistDocId), { authUid: uid }, { merge: true }); } catch(_){ }
      }
      if (data.loginEmail && data.loginEmail.toLowerCase() !== email.trim().toLowerCase()) {
        await logout();
        throw new Error('Email non associata a questo artista.');
      }
      const legacy = (data.loginCode || '').toString().trim().toUpperCase();
      const userLegacy = (singleCode || '').toString().trim().toUpperCase();
      const storedIpiIsni = (data.ipiIsni || '').toString().replace(/\s+/g,'').toUpperCase();
      const ipiUser = (ipiCode || '').toString().replace(/\s+/g,'').toUpperCase();
      const isniUser = (isniCode || '').toString().replace(/\s+/g,'').toUpperCase();
      const hasIpiIsniMatch = storedIpiIsni && (storedIpiIsni === ipiUser || storedIpiIsni === isniUser);
      const hasLegacyMatch = legacy && userLegacy && legacy === userLegacy;
      if (!hasIpiIsniMatch && !hasLegacyMatch) {
        await logout();
        throw new Error('Codici IPI / ISNI o Codice univoco non validi.');
      }
      navigate('/artist-dashboard');
    } catch (err) {
      setError(err.message || 'Errore di accesso');
    } finally {
      setSubmitting(false);
    }
  }

  const onAudFileSelect = useCallback((f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setAudStatus('File troppo grande (>10MB)');
      setAudFile(null);
      return;
    }
    setAudFile(f);
    setAudStatus('File pronto: ' + f.name);
  }, []);

  async function handleAuditionSubmit(e) {
    e.preventDefault();
    setAudStatus(''); setError(null);
    if (audSubmitting) return;
    if (!audName.trim() || !audEmail.trim()) { setError('Nome e Email richiesti'); return; }
    if (!audFile) { setError('Traccia MP3 richiesta'); return; }
    try {
      setAudSubmitting(true);
      const slug = audName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40) || 'audition';
      const folder = `auditions/${slug}-${Date.now()}`;
      const safeName = audFile.name.toLowerCase().endsWith('.mp3') ? audFile.name : audFile.name.replace(/\.[^.]+$/,'') + '.mp3';
      const path = `${folder}/${safeName}`;
      const sref = stRef(storage, path);
      await uploadBytes(sref, audFile, { contentType: 'audio/mpeg' });
      const url = await getDownloadURL(sref);
      const docData = {
        name: audName.trim(),
        email: audEmail.trim(),
        linkSpotifySoundCloud: audLinkSpotify.trim() || null,
        linkAppleMusic: audLinkApple.trim() || null,
        fileUrls: [url],
        createdAt: Date.now()
      };
      await addDoc(collection(db, 'auditions'), docData);
      try {
        const sendFn = httpsCallable(functions, 'sendAuditionNotification');
        await sendFn({ name: audName.trim(), email: audEmail.trim(), linkSpotifySoundCloud: audLinkSpotify.trim(), linkAppleMusic: audLinkApple.trim(), fileUrls: [url] });
      } catch (_e) {}
      setAudStatus('Tracce inviate – Sounds ti ricontatta presto!');
      setAudFile(null); setAudLinkSpotify(''); setAudLinkApple('');
    } catch (e2) {
      setError(e2.message || 'Errore invio audition');
    } finally {
      setAudSubmitting(false);
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
      <div className="detail-panel" style={{ backdropFilter:'blur(4px)', padding:0 }}>
        <div style={{ display:'flex', width:'100%' }}>
          <button type="button" onClick={()=>setTab('code')} className={tab==='code'?'tab-btn-active':'tab-btn'} style={{ flex:1 }}>Con Codice</button>
          <button type="button" onClick={()=>setTab('audition')} className={tab==='audition'?'tab-btn-active':'tab-btn'} style={{ flex:1 }}>Prova Rapida</button>
        </div>
      </div>
      {tab==='code' && (
        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-title">Dashboard Artista</h2>
          <div className="login-hint" style={{marginBottom:12, color:'#bbb'}}>Email, password + codici IPI / ISNI oppure Codice univoco legacy</div>
          <label className="login-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="login-input"
            autoComplete="username"
            inputMode="email"
          />
          <label className="login-label login-password-label">Password</label>
          <div className="login-password-wrapper">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="login-input login-password-input"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              aria-label={showPass ? 'Nascondi password' : 'Mostra password'}
              className="login-eye-btn"
              data-active={showPass ? 'true' : 'false'}
            >
              {showPass ? (
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path d="M3 3l18 18" strokeLinecap="round"/>
                  <path d="M10.58 10.58A3 3 0 0 0 12 15a3 3 0 0 0 2.42-4.42M9.88 5.54A9.77 9.77 0 0 1 12 5c5.52 0 9 5.5 9 7-.24.9-1.03 2.24-2.34 3.55M6.35 6.35C4.32 7.64 3.24 9.46 3 12c0 1.5 3.48 7 9 7 1.38 0 2.66-.26 3.82-.76" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path d="M1 12s3.5-7 11-7 11 7 11 7-3.5 7-11 7S1 12 1 12Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
              )}
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label className="login-label">Codice IPI</label>
              <input type="text" value={ipiCode} onChange={e=>setIpiCode(e.target.value)} className="login-input" placeholder="123456789" />
            </div>
            <div>
              <label className="login-label">Codice ISNI</label>
              <input type="text" value={isniCode} onChange={e=>setIsniCode(e.target.value)} className="login-input" placeholder="0000 0001 2281 955X" />
            </div>
          </div>
          <label className="login-label" style={{ marginTop:12 }}>Codice univoco (legacy)</label>
          <input
            type="text"
            value={singleCode}
            onChange={e => setSingleCode(e.target.value)}
            className="login-input"
            placeholder="AR-7F29-KQ"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
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
      )}
      {tab==='audition' && (
        <form onSubmit={handleAuditionSubmit} className="login-form" style={{ marginTop:16 }}>
          <h2 className="login-title">Prova Rapida Creativo</h2>
          <div className="login-hint" style={{marginBottom:12, color:'#bbb'}}>Invia una traccia MP3 (max 10MB). Se ci colpisce, accesso rapido.</div>
          <label className="login-label">Nome</label>
          <input type="text" value={audName} onChange={e=>setAudName(e.target.value)} required className="login-input" />
          <label className="login-label" style={{ marginTop:8 }}>Email</label>
          <input type="email" value={audEmail} onChange={e=>setAudEmail(e.target.value)} required className="login-input" />
          <label className="login-label" style={{ marginTop:8 }}>Link Spotify / SoundCloud (opzionale)</label>
          <input type="text" value={audLinkSpotify} onChange={e=>setAudLinkSpotify(e.target.value)} className="login-input" placeholder="https://..." />
          <label className="login-label" style={{ marginTop:8 }}>Link Apple Music (opzionale)</label>
          <input type="text" value={audLinkApple} onChange={e=>setAudLinkApple(e.target.value)} className="login-input" placeholder="https://..." />
          <div style={{ marginTop:12, border:'1px dashed #4ade80', borderRadius:10, padding:16, textAlign:'center', cursor:'pointer' }}
            onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; }}
            onDrop={(e)=>{ e.preventDefault(); const f = e.dataTransfer.files?.[0]; onAudFileSelect(f); }}
            onClick={()=>{ const inp = document.createElement('input'); inp.type='file'; inp.accept='audio/mpeg,audio/mp3'; inp.onchange=(ev)=>{ const f=ev.target.files?.[0]; onAudFileSelect(f); }; inp.click(); }}>
            {audFile ? <div style={{ color:'#22c55e', fontWeight:600 }}>{audFile.name}</div> : <div style={{ color:'#e5e7eb' }}>Trascina qui la tua traccia MP3 o clicca</div>}
            <div style={{ fontSize:12, color:'#93c5fd', marginTop:6 }}>Max 10MB – un solo file</div>
          </div>
          {error && <div className="login-error" style={{marginTop:10}}>{error}</div>}
          {audStatus && <div style={{ marginTop:10, color:'#22c55e', fontSize:13 }}>{audStatus}</div>}
          <button type="submit" disabled={audSubmitting} className="login-submit" style={{marginTop:16}}>
            {audSubmitting ? 'Invio…' : 'Invia a Sounds'}
          </button>
        </form>
      )}
    </div>
  );
}
