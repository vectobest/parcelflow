import { useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';

const ROLES = [
  { value: 'OPERATOR', label: 'Operator -- route parcels, upload batches, retry failures' },
  { value: 'REVIEWER', label: 'Reviewer -- also approves insurance holds' },
  { value: 'ADMIN', label: 'Admin -- also manages policies, drills, users and audit' }
];

const inputClass = 'w-full bg-surface-container-lowest border border-outline-variant text-on-surface font-code-sm text-code-sm px-space-sm py-space-xs focus:outline-none focus:border-primary';
const labelClass = 'block font-label-caps text-label-caps uppercase text-on-surface-variant mb-space-2xs';

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
    <div className="min-h-screen bg-surface text-on-surface font-body-regular flex items-center justify-center p-space-md">
      <div className="w-full max-w-sm bg-surface-container-low border border-outline-variant">
        <div className="h-14 px-space-md flex items-center gap-space-sm border-b border-outline-variant bg-surface-container-lowest">
          <Icon name="hub" className="text-primary text-[20px]" />
          <div className="flex flex-col">
            <span className="font-headline-md text-headline-md tracking-tight text-on-surface font-bold">PARCELFLOW</span>
            <span className="font-kpi-micro text-kpi-micro text-on-surface-variant">CONTROL ROOM // V2</span>
          </div>
        </div>

        <div className="p-space-lg flex flex-col gap-space-md">
          <p className="font-body-compact text-body-compact text-on-surface-variant">Sign in to route parcels, review policy and investigate incidents.</p>

          {oauthEnabled ? (
            <Button variant="primary" onClick={loginWithGoogle} type="button" className="w-full py-space-sm">
              <Icon name="login" className="text-[16px]" />
              Sign in with Google
            </Button>
          ) : (
            <>
              <div className="bg-surface-container px-space-sm py-space-xs font-body-compact text-body-compact text-on-surface-variant border-l-2 border-secondary">
                Google OAuth isn't configured on this server, so local dev sign-in is active instead. Set <code className="text-on-surface">GOOGLE_CLIENT_ID</code> / <code className="text-on-surface">GOOGLE_CLIENT_SECRET</code> in <code className="text-on-surface">server/.env</code> to enable real Google sign-in.
              </div>
              <form onSubmit={handleDevLogin} className="flex flex-col gap-space-sm">
                <div>
                  <label className={labelClass} htmlFor="login-email">Email</label>
                  <input id="login-email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="login-name">Name</label>
                  <input id="login-name" type="text" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="login-role">Role</label>
                  <select id="login-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <Button type="submit" variant="primary" disabled={busy} className="w-full py-space-sm mt-space-2xs">{busy ? 'Signing in...' : 'Continue'}</Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
