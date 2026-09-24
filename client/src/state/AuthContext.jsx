import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

// Module-scoped (not component state): survives React StrictMode's dev-only
// double-invoke of effects and any other duplicate mount within the same
// page load, so the auto-login below only ever fires once per page load
// instead of repeatedly hitting the (deliberately strict) auth rate limiter.
let autoLoginAttempted = false;

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const syncIdentity = useCallback(async () => {
    const me = await api('/auth/me');
    setOauthEnabled(Boolean(me.oauthEnabled));
    setIdentity(me.actor ? { actor: me.actor, role: me.role, name: me.name } : null);
    return me;
  }, []);

  const devLogin = useCallback(async ({ email, name, role }) => {
    await api('/auth/dev-login', { method: 'POST', body: { email, name, role } });
    await syncIdentity();
  }, [syncIdentity]);

  const refresh = useCallback(async () => {
    try {
      const me = await syncIdentity();
      if (!me.actor && !me.oauthEnabled && !autoLoginAttempted) {
        // No auth configured and nobody's signed in -- skip the login screen entirely
        // and sign straight in as an admin so the whole app is visible immediately.
        autoLoginAttempted = true;
        await devLogin({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN' });
      }
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, [syncIdentity, devLogin]);

  useEffect(() => { refresh(); }, [refresh]);

  const loginWithGoogle = useCallback(() => {
    window.location.href = '/api/auth/google';
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setIdentity(null);
  }, []);

  return (
    <AuthContext.Provider value={{ identity, oauthEnabled, loading, refresh, devLogin, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
