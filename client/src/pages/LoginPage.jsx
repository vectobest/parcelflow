import { useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';

const ROLES = [
  { value: 'OPERATOR', label: 'Operator -- route parcels, upload batches, retry failures' },
  { value: 'REVIEWER', label: 'Reviewer -- also approves insurance holds' },
  { value: 'ADMIN', label: 'Admin -- also manages policies, drills, users and audit' }
];

export default function LoginPage() {
  const { oauthEnabled, loginWithGoogle, devLogin } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('operator@example.com');
  const [name, setName] = useState('Demo Operator');
  const [role, setRole] = useState('OPERATOR');
  const [busy, setBusy] = useState(false);

  async function handleDevLogin(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await devLogin({ email, name, role });
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1>ParcelFlow Control Room</h1>
        <p className="muted">Sign in to route parcels, review policy and investigate incidents.</p>

        {oauthEnabled ? (
          <button className="button primary" style={{ width: '100%' }} onClick={loginWithGoogle} type="button">Sign in with Google</button>
        ) : (
          <>
            <div className="recommendation" style={{ marginBottom: 16 }}>
              Google OAuth isn't configured on this server, so local dev sign-in is active instead. Set <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> in <code>server/.env</code> to enable real Google sign-in (see <code>server/.env.example</code>).
            </div>
            <form onSubmit={handleDevLogin}>
              <div className="field">
                <label htmlFor="login-email">Email</label>
                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="login-name">Name</label>
                <input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="login-role">Role</label>
                <select id="login-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button className="button primary" type="submit" disabled={busy} style={{ width: '100%' }}>{busy ? 'Signing in...' : 'Continue'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
