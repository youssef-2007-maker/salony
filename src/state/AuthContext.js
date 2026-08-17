import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadToken, saveToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch (e) {
        await saveToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { token, user } = await api.login({ email, password });
    await saveToken(token);
    setUser(user);
    return user;
  }, []);

  const signup = useCallback(async (body) => {
    const { token, user } = await api.signup(body);
    await saveToken(token);
    setUser(user);
    return user;
  }, []);

  const signOut = useCallback(async () => {
    await saveToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, signOut, isAuthed: !!user, role: user?.role }),
    [user, loading, login, signup, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
