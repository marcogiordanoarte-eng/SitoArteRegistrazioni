import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, registerUser, loginUser, logoutUser } from './firebase';
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

  const signup = useCallback(async (email, password) => {
    setError(null);
    const u = await registerUser(email, password);
    setUser(u);
    return u;
  }, []);

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

  const value = { user, loading, error, signup, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
