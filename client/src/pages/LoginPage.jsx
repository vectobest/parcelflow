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

const inputClass = 'w-full bg-surface-container/60 rounded-xl border border-white/[0.08] text-on-surface font-code-sm text-code-sm px-3 py-2 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all';
const labelClass = 'block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70 mb-1.5';

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
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-20 w-[550px] h-[550px] bg-primary/10 rounded-full blur-[130px] opacity-70" />
        <div className="absolute top-[28%] right-[-100px] w-[600px] h-[600px] bg-secondary-container/20 rounded-full blur-[140px] opacity-60" />
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-surface-container-low/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl relative z-10">
        <div className="h-16 px-4 flex items-center gap-3 border-b border-white/[0.06] bg-surface-container-lowest/70 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/30 to-primary-container/20 border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_12px_rgba(208,188,255,0.25)]">
            <Icon name="hub" className="text-[22px]" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[16px] tracking-tight text-white">PARCELFLOW</span>
            <span className="font-mono text-[10px] text-on-surface-variant/80 tracking-wider uppercase font-semibold">Control Room // V2</span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <p className="text-[13px] text-on-surface-variant font-medium">Sign in to route parcels, review policy and investigate incidents.</p>

          {oauthEnabled ? (
            <Button variant="primary" onClick={loginWithGoogle} type="button" className="w-full py-2.5">
              <Icon name="login" className="text-[16px]" />
              Sign in with Google
            </Button>
          ) : (
            <>
              <div className="p-3 rounded-xl bg-surface-container/70 text-[12px] text-on-surface-variant border-l-2 border-secondary">
                Google OAuth isn't configured on this server, so local dev sign-in is active instead. Set <code className="text-on-surface">GOOGLE_CLIENT_ID</code> / <code className="text-on-surface">GOOGLE_CLIENT_SECRET</code> in <code className="text-on-surface">server/.env</code> to enable real Google sign-in.
              </div>
              <form onSubmit={handleDevLogin} className="flex flex-col gap-3">
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
