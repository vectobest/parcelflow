import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';

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

  if (identity.role !== 'ADMIN') {
    return (
      <div className="border border-dashed border-outline-variant px-space-md py-space-xl text-center font-body-compact text-body-compact text-on-surface-variant">
        Sign in as an admin to run security and chaos drills.
      </div>
    );
  }

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Governance" title="Security Center" description="Admin-only. Every drill runs against real security/incident code and never touches real batches, policies or approvals." />

      <Panel
        icon="security"
        title="Security Drill"
        meta="Attack Simulation"
        actions={securityReport && <Badge tone={securityReport.status === 'PROTECTED' ? 'LOW' : 'HIGH'}>{securityReport.status}</Badge>}
      >
        <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">Runs 8 real attack scenarios (oversized upload, XXE, prototype pollution, unauthorized actions, invalid auth, replay) against the actual security code and reports whether each was genuinely blocked.</p>
        <Button variant="primary" onClick={runSecurityDrill} disabled={busy}>Run Security Drill</Button>
        {securityReport && (
          <ul className="mt-space-sm flex flex-col gap-space-xs">
            {securityReport.results.map((r) => (
              <li key={r.scenario} className="flex flex-wrap items-center gap-space-xs font-body-compact text-body-compact border-b border-outline-variant pb-space-xs last:border-b-0">
                <Badge tone={r.blocked ? 'LOW' : 'HIGH'}>{r.blocked ? 'BLOCKED' : 'NOT BLOCKED'}</Badge>
                <strong className="font-code-sm text-code-sm text-on-surface">{r.scenario}</strong>
                <span className="text-on-surface-variant">&mdash; {r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon="local_fire_department" title="Chaos Drill" meta="Failure Simulation">
        <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">Synthesizes a failure and walks it through the real incident lifecycle: FAILURE &rarr; DETECTION &rarr; INCIDENT &rarr; SAFE DEGRADATION &rarr; RECOVERY &rarr; AUDIT.</p>
        <div className="flex flex-wrap gap-space-xs mb-space-sm">
          {Object.entries(scenarios).map(([key, description]) => (
            <Button key={key} variant="outline" size="sm" title={description} onClick={() => runChaosDrill(key)} disabled={busy}>{key.replaceAll('_', ' ')}</Button>
          ))}
        </div>
        {chaosReport && (
          <ul className="flex flex-col gap-space-xs">
            {chaosReport.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-space-xs font-body-compact text-body-compact text-on-surface border-b border-outline-variant pb-space-xs last:border-b-0">
                <Badge tone="MEDIUM">{s.stage}</Badge> {s.detail}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
