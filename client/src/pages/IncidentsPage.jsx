import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';

const NEXT_STATUS = { NEW: 'ACKNOWLEDGED', ACKNOWLEDGED: 'INVESTIGATING', INVESTIGATING: 'MITIGATING', MITIGATING: 'RESOLVED' };

export default function IncidentsPage() {
  const { identity } = useAuth();
  const [incidents, setIncidents] = useState([]);
  const handleError = useApiError();
  const toast = useToast();

  const load = useCallback(async () => {
    try { setIncidents([...(await api('/incidents'))].reverse()); } catch (error) { handleError(error, 'Loading incidents'); }
  }, [handleError]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function advance(incident) {
    const next = NEXT_STATUS[incident.status];
    if (!next) return;
    try {
      await api(`/incidents/${incident.incidentId}/transition`, { body: { status: next } });
      toast(`${incident.incidentId} moved to ${next}.`);
      await load();
    } catch (error) { handleError(error, 'Updating incident'); }
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Intelligence" title="Incident Center" description="Related failures are grouped into one incident instead of one alert per parcel." />

      {incidents.length === 0 && (
        <div className="border border-dashed border-outline-variant px-space-md py-space-xl text-center font-body-compact text-body-compact text-on-surface-variant">
          No incidents detected this session.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        {incidents.map((incident) => (
          <Panel key={incident.incidentId} meta={incident.incidentId} title={incident.status} actions={<Badge tone={incident.severity}>{incident.severity}</Badge>}>
            <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-xs">Failure rate {(incident.failureRateBefore * 100).toFixed(1)}% &rarr; {(incident.failureRateAfter * 100).toFixed(1)}%, {incident.evidenceCount} related failures</p>
            <p className="font-body-compact text-body-compact text-on-surface mb-space-sm">{incident.likelyCause}</p>
            <ul className="flex flex-col gap-space-3xs mb-space-sm list-disc pl-4">
              {incident.recommendedActions.map((a, i) => <li key={i} className="font-body-compact text-body-compact text-on-surface-variant">{a}</li>)}
            </ul>
            {identity.role === 'ADMIN' && incident.status !== 'RESOLVED' && (
              <Button variant="outline" size="sm" onClick={() => advance(incident)}>Move to {NEXT_STATUS[incident.status]}</Button>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
