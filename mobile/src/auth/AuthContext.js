import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setUnauthorizedHandler } from '../services/api';
import { clearToken, getToken, saveToken } from '../services/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState('');

  useEffect(() => setUnauthorizedHandler(() => {
    setUser(null);
    setInitializationError('Your session is invalid or has expired. Please sign in again.');
  }), []);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const token = await getToken();
        if (token) {
          const result = await api.getCurrentUser();
          if (mounted) setUser(result.user);
        }
      } catch (error) {
        if (error.status === 401) await clearToken();
        if (mounted) setInitializationError(error.message);
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    restoreSession();
    return () => { mounted = false; };
  }, []);

  const establishSession = useCallback(async (token) => {
    await saveToken(token);
    try {
      const result = await api.getCurrentUser();
      setUser(result.user);
      setInitializationError('');
    } catch (error) {
      await clearToken();
      throw error;
    }
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await api.login(email, password);
    await establishSession(result.token);
  }, [establishSession]);

  const register = useCallback(async (name, email, password) => {
    const result = await api.register(name, email, password);
    await establishSession(result.token);
  }, [establishSession]);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
    setInitializationError('');
  }, []);

  const value = useMemo(() => ({
    user,
    initializing,
    initializationError,
    signIn,
    register,
    signOut,
  }), [user, initializing, initializationError, signIn, register, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
