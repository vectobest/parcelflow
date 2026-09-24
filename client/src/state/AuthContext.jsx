import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

// Module-scoped (not component state): dedupes concurrent auto-login calls
// from React StrictMode's dev-only double-invoke of effects, without
// permanently blocking a later retry if the attempt actually failed.
let autoLoginInFlight = null;

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
      if (!me.actor && !me.oauthEnabled) {
        // No auth configured and nobody's signed in -- skip the login screen entirely
        // and sign straight in as an admin so the whole app is visible immediately.
        if (!autoLoginInFlight) {
          autoLoginInFlight = devLogin({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN' })
            .finally(() => { autoLoginInFlight = null; });
        }
        await autoLoginInFlight;
      }
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, [syncIdentity, devLogin]);

  useEffect(() => { refresh(); }, [refresh]);

  // If auto sign-in failed (e.g. a transient rate limit) rather than succeeding,
  // retry after a short delay instead of leaving the app stuck on the holding screen.
  useEffect(() => {
    if (loading || identity || oauthEnabled) return;
    const timer = setTimeout(refresh, 3000);
    return () => clearTimeout(timer);
  }, [loading, identity, oauthEnabled, refresh]);

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
