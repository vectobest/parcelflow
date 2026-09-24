import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(null);
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api('/auth/me');
      setOauthEnabled(Boolean(me.oauthEnabled));
      setIdentity(me.actor ? { actor: me.actor, role: me.role, name: me.name } : null);
    } catch {
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const devLogin = useCallback(async ({ email, name, role }) => {
    await api('/auth/dev-login', { method: 'POST', body: { email, name, role } });
    await refresh();
  }, [refresh]);

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
