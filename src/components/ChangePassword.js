import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export default function ChangePassword() {
  const { user, updatePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [working, setWorking] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    if (!currentPassword || !newPassword) {
      setError('Compila tutti i campi');
      return;
    }
    if (newPassword.length < 6) {
      setError('La nuova password deve avere almeno 6 caratteri');
      return;
    }
    if (newPassword !== confirm) {
      setError('Le password non coincidono');
      return;
    }
    try {
      setWorking(true);
      await updatePassword(currentPassword, newPassword);
      setOk('Password aggiornata correttamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (e) {
      setError(e && e.message ? e.message : 'Errore durante l\'aggiornamento');
    } finally {
      setWorking(false);
    }
  }

  if (!user) {
    return <div style={{padding:24}}>Devi essere autenticato per cambiare password.</div>;
  }

  return (
    <div className="change-pass-root" style={{padding:24, maxWidth:540, margin:'40px auto'}}>
      <h2>Cambia password</h2>
      <form onSubmit={onSubmit}>
        <label>Password attuale</label>
        <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required className="login-input" />
        <label>Nuova password</label>
        <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={6} className="login-input" />
        <label>Conferma nuova password</label>
        <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={6} className="login-input" />
        {error && <div className="login-error" style={{marginTop:8}}>{error}</div>}
        {ok && <div className="login-success" style={{marginTop:8}}>{ok}</div>}
        <button type="submit" className="login-submit" disabled={working} style={{marginTop:12}}>{working ? 'Aggiornamento…' : 'Aggiorna'}</button>
      </form>
    </div>
  );
}
