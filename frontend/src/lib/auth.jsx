import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';

const AuthContext = createContext(null);
const RANK = { MEMBER: 1, OFFICER: 2, ADMIN: 3 };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get('/auth/me');
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setUser(null);
    window.addEventListener('blc-auth-expired', onExpired);
    return () => window.removeEventListener('blc-auth-expired', onExpired);
  }, [refresh]);

  const startSession = useCallback(({ token, user: u }) => {
    tokenStore.set(token);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      refresh,
      login: async (email, password) => startSession(await api.post('/auth/login', { email, password })),
      acceptInvite: async (token, password) => startSession(await api.post('/auth/accept-invite', { token, password })),
      logout: () => {
        tokenStore.clear();
        setUser(null);
      },
      hasRole: (min) => Boolean(user) && RANK[user.role] >= RANK[min],
    }),
    [user, loading, refresh, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
