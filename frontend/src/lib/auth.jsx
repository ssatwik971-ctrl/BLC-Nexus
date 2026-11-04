import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getUser, login as identityLogin, logout as identityLogout, handleAuthCallback, requestPasswordRecovery, acceptInvite as identityAcceptInvite, updateUser } from '@netlify/identity';
import { api } from './api.js';

const AuthContext = createContext(null);
const RANK = { MEMBER: 1, OFFICER: 2, ADMIN: 3 };

// The admin session cookie is HttpOnly, so JavaScript cannot see it. This flag only
// tells the app whether it is worth asking the server "am I signed in as admin?".
const ADMIN_HINT = 'blc-admin-hint';
const hint = {
  has: () => { try { return localStorage.getItem(ADMIN_HINT) === '1'; } catch { return false; } },
  set: () => { try { localStorage.setItem(ADMIN_HINT, '1'); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(ADMIN_HINT); } catch { /* ignore */ } },
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async ({ throwOnError = false } = {}) => {
    try {
      if (hint.has()) {
        // Admin session (email + PIN). Falls through to Netlify Identity if there isn't one.
        try {
          const admin = await api.get('/auth/me');
          if (admin?.user) { setUser(admin.user); return admin.user; }
        } catch (err) {
          if (err.status !== 401) throw err;
          hint.clear();
        }
      }
      const identityUser = await getUser();
      if (!identityUser) { setUser(null); return null; }
      let response;
      try { response = await api.get('/auth/me'); }
      catch (err) {
        if (err.status === 401) response = await api.post('/auth/identity/link');
        else throw err;
      }
      if (!response?.user) throw new Error('Your sign-in succeeded, but your BLC Nexus member profile could not be loaded. Please contact an administrator.');
      setUser(response.user);
      return response.user;
    } catch (error) {
      setUser(null);
      if (throwOnError) throw error;
      console.error('BLC Nexus account sync failed:', error);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await handleAuthCallback();
        if (result?.type === 'invite' && result.token) { window.location.replace(`/accept-invite?token=${encodeURIComponent(result.token)}`); return; }
        if (result?.type === 'recovery') { window.location.replace('/reset-password?recovery=1'); return; }
      } catch (e) { console.error('Netlify Identity callback failed', e); }
      if (alive) await refresh();
    })();
    const onExpired = () => setUser(null);
    window.addEventListener('blc-auth-expired', onExpired);
    return () => { alive = false; window.removeEventListener('blc-auth-expired', onExpired); };
  }, [refresh]);

  const finishInvite = useCallback(async (token, password) => {
    if (!token) throw new Error('Invitation token is missing. Open the invitation email again.');
    await identityAcceptInvite(token, password);
    await refresh();
  }, [refresh]);

  const finishRecovery = useCallback(async (password) => {
    await updateUser({ password });
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    user, loading, refresh,
    login: async (email, password) => {
      await identityLogin(email, password);
      try {
        const linkedUser = await refresh({ throwOnError: true });
        if (!linkedUser) throw new Error('Your BLC Nexus member profile could not be loaded.');
      } catch (error) {
        // Keep the Identity session intact so a temporary database issue does not lock the user out.
        throw new Error(error?.message || 'Signed in, but your BLC Nexus account could not be synchronized.');
      }
    },
    adminLogin: async (email, pin) => {
      const response = await api.post('/auth/admin-login', { email, pin });
      hint.set();
      setUser(response.user);
      return response.user;
    },
    acceptInvite: finishInvite,
    finishRecovery,
    requestPasswordRecovery,
    logout: async () => {
      if (hint.has()) {
        try { await api.post('/auth/admin-logout'); } catch { /* the cookie expires on its own */ }
        hint.clear();
      }
      try { await identityLogout(); } catch { /* no Identity session to end */ }
      setUser(null);
    },
    hasRole: (min) => Boolean(user) && RANK[user.role] >= RANK[min],
  }), [user, loading, refresh, finishInvite, finishRecovery]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
