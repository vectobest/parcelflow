import { useState } from 'react';
import { useAuth } from '../state/AuthContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { Field, Input, Select } from '../components/Field.jsx';

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
    <div className="min-h-screen bg-surface text-on-surface font-sans flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none z-0 depot-floor" aria-hidden="true" />
      <div className="w-full max-w-md relative z-10">
        <div className="h-2 hazard-stripe" aria-hidden="true" />
        <div className="bg-surface-container-low border border-t-0 border-white/[0.08] shadow-2xl">
          <div className="px-6 pt-6 pb-5 border-b border-white/[0.06] flex items-start justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] text-primary tracking-[0.16em] uppercase">Control Room · Dock 02</span>
              <h1 className="font-display font-black uppercase text-[48px] leading-[0.9] tracking-[0.02em] text-white mt-2">ParcelFlow</h1>
              <p className="text-[14px] text-on-surface-variant mt-3">Sign in to route parcels, review policy and investigate incidents.</p>
            </div>
            <div className="w-12 h-12 rounded-sm bg-primary flex items-center justify-center text-on-primary shrink-0">
              <Icon name="hub" className="text-[28px]" />
            </div>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {oauthEnabled ? (
              <Button variant="primary" onClick={loginWithGoogle} type="button" className="w-full py-3">
                <Icon name="login" className="text-[18px]" />
                Sign in with Google
              </Button>
            ) : (
              <>
                <div className="px-4 py-3 bg-surface-container-lowest text-[13px] text-on-surface-variant border-l-[3px] border-secondary">
                  Google OAuth isn't configured on this server, so local dev sign-in is active instead. Set <code className="font-mono text-on-surface">GOOGLE_CLIENT_ID</code> / <code className="font-mono text-on-surface">GOOGLE_CLIENT_SECRET</code> in <code className="font-mono text-on-surface">server/.env</code> to enable real Google sign-in.
                </div>
                <form onSubmit={handleDevLogin} className="flex flex-col gap-3">
                  <Field label="Email" htmlFor="login-email">
                    <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </Field>
                  <Field label="Name" htmlFor="login-name">
                    <Input id="login-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
                  </Field>
                  <Field label="Role" htmlFor="login-role">
                    <Select id="login-role" value={role} onChange={(e) => setRole(e.target.value)}>
                      {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </Select>
                  </Field>
                  <Button type="submit" variant="primary" disabled={busy} className="w-full py-3 mt-1">{busy ? 'Signing in...' : 'Continue'}</Button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
