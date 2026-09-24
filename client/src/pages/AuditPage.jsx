import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { ApiError } from '../api/client.js';

export default function AuditPage() {
  const [events, setEvents] = useState(null);
  const [denied, setDenied] = useState(false);
  const handleError = useApiError();

  useEffect(() => {
    api('/audit').then(setEvents).catch((error) => {
      if (error instanceof ApiError && error.status === 403) setDenied(true);
      else handleError(error, 'Loading audit log');
    });
  }, [handleError]);

  return (
    <div>
      <div className="section-head"><div><h1>Audit log</h1><p>Every policy, approval, batch and login action, newest first. Admin-only.</p></div></div>

      {denied && <div className="empty-state">Sign in as an admin to view the audit trail.</div>}
      {!denied && !events && <p className="muted">Loading...</p>}
      {!denied && events && (
        <article className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Correlation ID</th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={5} className="muted">No audited actions yet.</td></tr>}
                {events.slice(0, 200).map((e) => (
                  <tr key={e.eventId}>
                    <td className="mono">{new Date(e.timestamp).toLocaleString()}</td>
                    <td>{e.actor}</td>
                    <td className="mono">{e.action}</td>
                    <td className="mono">{e.entityId || '—'}</td>
                    <td className="mono muted">{e.correlationId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}
