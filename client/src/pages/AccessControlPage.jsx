import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Panel from '../components/Panel.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Select } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

const ROLES = ['OPERATOR', 'REVIEWER', 'ADMIN'];

export default function AccessControlPage() {
  const { identity } = useAuth();
  const [users, setUsers] = useState(null);
  const handleError = useApiError();
  const toast = useToast();

  const load = useCallback(async () => {
    try { setUsers(await api('/auth/users')); } catch (error) { handleError(error, 'Loading users'); }
  }, [handleError]);

  useEffect(() => { if (identity.role === 'ADMIN') load(); }, [identity.role, load]);

  if (identity.role !== 'ADMIN') {
    return (
      <div className="border border-dashed border-outline-variant px-space-md py-space-xl text-center font-body-compact text-body-compact text-on-surface-variant">
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

  return (
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Governance" title="Access Control" description="Everyone who has signed in this session, and their role. Role changes take effect immediately (in-memory; resets on server restart)." />

      <Panel icon="admin_panel_settings" bodyClassName="">
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
