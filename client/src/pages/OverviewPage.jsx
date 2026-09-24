import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';

const HEALTH_TONE = { HEALTHY: 'LOW', DEGRADED: 'MEDIUM', CRITICAL: 'HIGH' };

export default function OverviewPage() {
  const [dashboard, setDashboard] = useState(null);
  const handleError = useApiError();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api('/dashboard');
        if (!cancelled) setDashboard(data);
      } catch (error) {
        if (!cancelled) handleError(error, 'Loading dashboard');
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [handleError]);

  if (!dashboard) return <p className="muted">Loading dashboard...</p>;
  const { snapshot, risk, health, attentionRequired } = dashboard;

  return (
    <div>
      <div className="section">
        <div className="section-head">
          <div>
            <h1>Is everything okay?</h1>
            <p>{snapshot.totalParcels} parcels processed this session on policy {snapshot.activePolicy}.</p>
          </div>
          <Badge tone={HEALTH_TONE[health] || 'MEDIUM'}>{health}</Badge>
        </div>

        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <div className="stat routed"><span>Routed</span><strong>{snapshot.successful}</strong></div>
          <div className="stat pending"><span>Awaiting approval</span><strong>{snapshot.pendingApproval}</strong></div>
          <div className="stat error"><span>Validation errors</span><strong>{snapshot.validationErrors}</strong></div>
        </div>

        {attentionRequired.length > 0 && (
          <article className="card" style={{ marginBottom: 16 }}>
            <div className="card-head"><h3>Needs attention</h3></div>
            <ul className="evidence">{attentionRequired.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </article>
        )}

        <article className="card">
          <div className="card-head">
            <div><span className="eyebrow">Operational intelligence</span><h3>{risk.title}</h3></div>
            <Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')}</Badge>
          </div>
          <p className="muted">{risk.message}</p>
          {risk.evidence.length > 0 && <ul className="evidence">{risk.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>}
          <p className="recommendation"><strong>Next step:</strong> {risk.recommendation}</p>
        </article>
      </div>

      <div className="button-row">
        <Link className="button primary" to="/intake">Route a parcel or batch &rarr;</Link>
        <Link className="button ghost" to="/incidents">View incident center &rarr;</Link>
        <Link className="button ghost" to="/assistant">Ask the Operations Assistant &rarr;</Link>
      </div>
    </div>
  );
}
