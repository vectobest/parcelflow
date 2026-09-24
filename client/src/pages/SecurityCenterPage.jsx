import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';

export default function SecurityCenterPage() {
  const { identity } = useAuth();
  const [scenarios, setScenarios] = useState({});
  const [securityReport, setSecurityReport] = useState(null);
  const [chaosReport, setChaosReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const handleError = useApiError();

  useEffect(() => {
    if (identity.role !== 'ADMIN') return;
    api('/drills/chaos/scenarios').then(setScenarios).catch((error) => handleError(error, 'Loading chaos scenarios'));
  }, [identity.role, handleError]);

  if (identity.role !== 'ADMIN') return <div className="empty-state">Sign in as an admin to run security and chaos drills.</div>;

  async function runSecurityDrill() {
    setBusy(true);
    try { setSecurityReport(await api('/drills/security', { method: 'POST' })); }
    catch (error) { handleError(error, 'Running security drill'); }
    finally { setBusy(false); }
  }

  async function runChaosDrill(key) {
    setBusy(true);
    try { setChaosReport(await api(`/drills/chaos/${key}`, { method: 'POST' })); }
    catch (error) { handleError(error, 'Running chaos drill'); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Security center</h1><p>Admin-only. Every drill runs against real security/incident code and never touches real batches, policies or approvals.</p></div></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div><span className="eyebrow">Attack simulation</span><h3>Security drill</h3></div>
          {securityReport && <Badge tone={securityReport.status === 'PROTECTED' ? 'LOW' : 'HIGH'}>{securityReport.status}</Badge>}
        </div>
        <p className="muted">Runs 8 real attack scenarios (oversized upload, XXE, prototype pollution, unauthorized actions, invalid auth, replay) against the actual security code and reports whether each was genuinely blocked.</p>
        <button className="button primary" type="button" onClick={runSecurityDrill} disabled={busy}>Run security drill &rarr;</button>
        {securityReport && (
          <ul className="steps" style={{ marginTop: 14 }}>
            {securityReport.results.map((r) => (
              <li key={r.scenario}><Badge tone={r.blocked ? 'LOW' : 'HIGH'}>{r.blocked ? 'BLOCKED' : 'NOT BLOCKED'}</Badge>&nbsp;<strong className="mono">{r.scenario}</strong> &mdash; {r.detail}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="card">
        <div className="card-head"><div><span className="eyebrow">Failure simulation</span><h3>Chaos drill</h3></div></div>
        <p className="muted">Synthesizes a failure and walks it through the real incident lifecycle: FAILURE &rarr; DETECTION &rarr; INCIDENT &rarr; SAFE DEGRADATION &rarr; RECOVERY &rarr; AUDIT.</p>
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {Object.entries(scenarios).map(([key, description]) => (
            <button key={key} className="button ghost small" type="button" title={description} onClick={() => runChaosDrill(key)} disabled={busy}>{key.replaceAll('_', ' ')}</button>
          ))}
        </div>
        {chaosReport && (
          <ul className="steps">
            {chaosReport.steps.map((s, i) => <li key={i}><Badge tone="MEDIUM">{s.stage}</Badge>&nbsp;{s.detail}</li>)}
          </ul>
        )}
      </article>
    </div>
  );
}
