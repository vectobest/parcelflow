import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';

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

  if (identity.role !== 'ADMIN') return <div className="empty-state">Sign in as an admin to manage user access.</div>;

  async function changeRole(email, role) {
    try {
      await api(`/auth/users/${encodeURIComponent(email)}/role`, { method: 'POST', body: { role } });
      toast(`${email} is now ${role}.`);
      await load();
    } catch (error) { handleError(error, 'Changing role'); }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Access control</h1><p>Everyone who has signed in this session, and their role. Role changes take effect immediately (in-memory; resets on server restart).</p></div></div>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Provider</th><th>Signed in</th><th>Role</th></tr></thead>
            <tbody>
              {!users && <tr><td colSpan={4} className="muted">Loading...</td></tr>}
              {users?.map((u) => (
                <tr key={u.email}>
                  <td>{u.name || u.email}<br /><span className="muted mono" style={{ fontSize: 11 }}>{u.email}</span></td>
                  <td>{u.provider}</td>
                  <td className="mono">{new Date(u.createdAt).toLocaleString()}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeRole(u.email, e.target.value)} disabled={u.email === identity.actor}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
