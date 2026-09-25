import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearAccessToken, hasAccessToken, saveAccessToken, setUnauthorizedHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const clearSession = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setChecking(false);
    setSessionError('');
  }, []);

  const validateSession = useCallback(async () => {
    setSessionError('');
    if (!hasAccessToken()) {
      setUser(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      if (hasAccessToken()) setSessionError('Could not verify your session. Check your connection and try again.');
      else setUser(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    validateSession();
    return () => setUnauthorizedHandler(null);
  }, [clearSession, validateSession]);

  const authenticate = useCallback(async (endpoint, credentials) => {
    const response = await api.post(endpoint, credentials);
    saveAccessToken(response.data.access_token);
    setUser(response.data.user);
    setSessionError('');
    return response.data.user;
  }, []);

  const login = useCallback((credentials) => authenticate('/auth/login', credentials), [authenticate]);
  const signup = useCallback((credentials) => authenticate('/auth/signup', credentials), [authenticate]);

  const logout = useCallback(async () => {
    try {
      if (hasAccessToken()) await api.post('/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(() => ({ user, checking, sessionError, login, signup, logout, validateSession }),
    [user, checking, sessionError, login, signup, logout, validateSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
