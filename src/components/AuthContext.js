import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, registerUser, loginUser, logoutUser, resetPassword, changeCurrentUserPassword } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u || null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const allowSignup = String(process.env.REACT_APP_ALLOW_SIGNUP || '').toLowerCase() === 'true';
  const signup = useCallback(async (email, password) => {
    setError(null);
    if (!allowSignup) {
      throw new Error('La registrazione self-service è disabilitata. Contatta l\'amministratore.');
    }
    const u = await registerUser(email, password);
    setUser(u);
    return u;
  }, [allowSignup]);

  const login = useCallback(async (email, password) => {
    setError(null);
    const u = await loginUser(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await logoutUser();
    setUser(null);
  }, []);

  const value = { user, loading, error, signup, login, logout, resetPassword, changeCurrentUserPassword, allowSignup };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
