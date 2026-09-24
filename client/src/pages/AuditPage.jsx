import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Panel from '../components/Panel.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Governance" title="Audit Log" description="Every policy, approval, batch and login action, newest first. Admin-only." />

      {denied && (
        <div className="border border-dashed border-outline-variant px-space-md py-space-xl text-center font-body-compact text-body-compact text-on-surface-variant">
          Sign in as an admin to view the audit trail.
        </div>
      )}
      {!denied && !events && <p className="font-code-sm text-code-sm text-on-surface-variant">Loading...</p>}
      {!denied && events && (
        <Panel icon="receipt_long" bodyClassName="">
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}>Time</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Entity</th><th className={th}>Correlation ID</th></tr></thead>
              <tbody>
                {events.length === 0 && <tr><td colSpan={5} className={`${td} text-on-surface-variant`}>No audited actions yet.</td></tr>}
                {events.slice(0, 200).map((e) => (
                  <tr key={e.eventId} className={tr}>
                    <td className={`${td} text-on-surface`}>{new Date(e.timestamp).toLocaleString()}</td>
                    <td className={td}>{e.actor}</td>
                    <td className={`${td} text-primary`}>{e.action}</td>
                    <td className={td}>{e.entityId || '—'}</td>
                    <td className={`${td} text-on-surface-variant`}>{e.correlationId || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
