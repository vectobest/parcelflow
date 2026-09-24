import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Panel from '../components/Panel.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';
import { Field, Input, Select } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

const ROLES = ['OPERATOR', 'REVIEWER', 'ADMIN'];

export default function AccessControlPage() {
  const { identity } = useAuth();
  const [users, setUsers] = useState(null);
  const [pending, setPending] = useState(null);
  const [presetEmail, setPresetEmail] = useState('');
  const [presetRole, setPresetRole] = useState('OPERATOR');
  const [submitting, setSubmitting] = useState(false);
  const handleError = useApiError();
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([api('/auth/users'), api('/auth/pending-roles')]);
      setUsers(u);
      setPending(p);
    } catch (error) { handleError(error, 'Loading users'); }
  }, [handleError]);

  useEffect(() => { if (identity.role === 'ADMIN') load(); }, [identity.role, load]);

  if (identity.role !== 'ADMIN') {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.12] px-6 py-12 text-center text-[13px] text-on-surface-variant">
        Sign in as an admin to manage user access.
      </div>
    );
  }

  async function changeRole(email, role) {
    try {
      await api(`/auth/users/${encodeURIComponent(email)}/role`, { method: 'POST', body: { role } });
      toast(`${email} is now ${role}.`);
      await load();
    } catch (error) { handleError(error, 'Changing role'); }
  }

  async function addPreset(event) {
    event.preventDefault();
    if (!presetEmail.trim()) return;
    setSubmitting(true);
    try {
      await api('/auth/pending-roles', { method: 'POST', body: { email: presetEmail.trim(), role: presetRole } });
      toast(`${presetEmail.trim()} will get ${presetRole} on first sign-in.`);
      setPresetEmail('');
      await load();
    } catch (error) { handleError(error, 'Pre-assigning role'); }
    finally { setSubmitting(false); }
  }

  async function removePreset(email) {
    try {
      await api(`/auth/pending-roles/${encodeURIComponent(email)}`, { method: 'DELETE' });
      toast(`Removed pending role for ${email}.`);
      await load();
    } catch (error) { handleError(error, 'Removing pending role'); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Governance" title="Access Control" description="Everyone who has signed in this session, and their role. Role changes take effect immediately (in-memory; resets on server restart)." />

      <Panel icon="person_add" title="Pre-Assign a Role" meta="Applies on first sign-in">
        <p className="text-[13px] text-on-surface-variant mb-4">Add someone's email before they've signed in, so they get the right role immediately instead of starting as OPERATOR.</p>
        <form onSubmit={addPreset} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Field label="Email" htmlFor="preset-email">
              <Input id="preset-email" type="email" placeholder="name@example.com" value={presetEmail} onChange={(e) => setPresetEmail(e.target.value)} required />
            </Field>
          </div>
          <div className="w-40">
            <Field label="Role" htmlFor="preset-role">
              <Select id="preset-role" value={presetRole} onChange={(e) => setPresetRole(e.target.value)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="primary" disabled={submitting}>
            <Icon name="add" className="text-[16px]" />
            {submitting ? 'Adding...' : 'Add'}
          </Button>
        </form>

        {pending?.length > 0 && (
          <div className="mt-5 flex flex-col gap-2">
            {pending.map((p) => (
              <div key={p.email} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container/60 border border-white/[0.06]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary flex items-center justify-center shrink-0">
                    <Icon name="schedule" className="text-[15px]" />
                  </span>
                  <span className="text-[13px] text-on-surface truncate">{p.email}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-secondary shrink-0">will be {p.role}</span>
                </div>
                <button type="button" onClick={() => removePreset(p.email)} className="text-on-surface-variant hover:text-error transition-colors shrink-0" title="Remove pending assignment">
                  <Icon name="close" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel icon="admin_panel_settings" title="Signed-In Users" bodyClassName="">
        <div className={tableWrap}>
          <table className={table}>
            <thead><tr className={thead}><th className={th}>User</th><th className={th}>Provider</th><th className={th}>Signed In</th><th className={th}>Role</th></tr></thead>
            <tbody>
              {!users && <tr><td colSpan={4} className={`${td} text-on-surface-variant`}>Loading...</td></tr>}
              {users?.map((u) => (
                <tr key={u.email} className={tr}>
                  <td className={td}>
                    <span className="text-on-surface">{u.name || u.email}</span>
                    <br />
                    <span className="text-on-surface-variant text-[10px]">{u.email}</span>
                  </td>
                  <td className={`${td} uppercase`}>{u.provider}</td>
                  <td className={td}>{new Date(u.createdAt).toLocaleString()}</td>
                  <td className={td}>
                    <Select value={u.role} onChange={(e) => changeRole(u.email, e.target.value)} disabled={u.email === identity.actor} className="max-w-[160px]">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
