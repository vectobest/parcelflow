import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';

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
    <div>
      <div className="section-head"><div><h1>Incident center</h1><p>Related failures are grouped into one incident instead of one alert per parcel.</p></div></div>

      {incidents.length === 0 && <div className="empty-state">No incidents detected this session.</div>}

      <div className="grid cols-2">
        {incidents.map((incident) => (
          <article className="card" key={incident.incidentId}>
            <div className="card-head">
              <div><span className="eyebrow">{incident.incidentId}</span><h3>{incident.status}</h3></div>
              <Badge tone={incident.severity}>{incident.severity}</Badge>
            </div>
            <p className="muted">Failure rate {(incident.failureRateBefore * 100).toFixed(1)}% &rarr; {(incident.failureRateAfter * 100).toFixed(1)}% &middot; {incident.evidenceCount} related failures</p>
            <p>{incident.likelyCause}</p>
            <ul className="evidence">{incident.recommendedActions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            {identity.role === 'ADMIN' && incident.status !== 'RESOLVED' && (
              <button className="button ghost small" type="button" onClick={() => advance(incident)}>Move to {NEXT_STATUS[incident.status]}</button>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
