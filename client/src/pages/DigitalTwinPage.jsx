import { useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Input } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

export default function DigitalTwinPage() {
  const [scenario, setScenario] = useState({ volumeMultiplier: 1.5, processingSpeedMultiplier: 1, reviewerCapacityMultiplier: 1, failureRateDelta: 0 });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const handleError = useApiError();

  async function run() {
    setBusy(true);
    try {
      setResult(await api('/digital-twin', { method: 'POST', body: {
        volumeMultiplier: Number(scenario.volumeMultiplier), processingSpeedMultiplier: Number(scenario.processingSpeedMultiplier),
        reviewerCapacityMultiplier: Number(scenario.reviewerCapacityMultiplier), failureRateDelta: Number(scenario.failureRateDelta)
      } }));
    } catch (error) { handleError(error, 'Running simulation'); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Intelligence" title="Digital Twin" description="What-if capacity projection. Never touches production data." actions={<Badge tone="LOW">Simulation</Badge>} />

      <Panel icon="device_hub" title="Scenario">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mb-space-sm">
          <Field label="Volume multiplier (e.g. 1.5 = +50%)"><Input type="number" step="0.1" min="0.1" value={scenario.volumeMultiplier} onChange={(e) => setScenario({ ...scenario, volumeMultiplier: e.target.value })} /></Field>
          <Field label="Processing speed multiplier (0.8 = 20% slower)"><Input type="number" step="0.1" min="0.1" value={scenario.processingSpeedMultiplier} onChange={(e) => setScenario({ ...scenario, processingSpeedMultiplier: e.target.value })} /></Field>
          <Field label="Reviewer capacity multiplier (0.5 = half capacity)"><Input type="number" step="0.1" min="0.1" value={scenario.reviewerCapacityMultiplier} onChange={(e) => setScenario({ ...scenario, reviewerCapacityMultiplier: e.target.value })} /></Field>
          <Field label="Failure rate delta (0.05 = +5 points)"><Input type="number" step="0.01" value={scenario.failureRateDelta} onChange={(e) => setScenario({ ...scenario, failureRateDelta: e.target.value })} /></Field>
        </div>
        <Button variant="primary" onClick={run} disabled={busy}>Run Projection &rarr;</Button>
      </Panel>

      {result && (
        <Panel icon="insights" title={result.label} bodyClassName="">
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}></th><th className={th}>Current</th><th className={th}>Projected</th></tr></thead>
              <tbody>
                <tr className={tr}><td className={`${td} text-on-surface-variant`}>Parcels</td><td className={td}>{result.current.parcels}</td><td className={`${td} text-on-surface font-bold`}>{result.projected.parcels}</td></tr>
                <tr className={tr}><td className={`${td} text-on-surface-variant`}>Approval queue</td><td className={td}>{result.current.approvals}</td><td className={`${td} text-on-surface font-bold`}>{result.projected.approvals}</td></tr>
                <tr className={tr}><td className={`${td} text-on-surface-variant`}>Failure rate</td><td className={td}>{(result.current.failureRate * 100).toFixed(1)}%</td><td className={`${td} text-on-surface font-bold`}>{(result.projected.failureRate * 100).toFixed(1)}%</td></tr>
                <tr className={tr}><td className={`${td} text-on-surface-variant`}>Avg. processing time</td><td className={td}>{result.current.averageProcessingMs}ms</td><td className={`${td} text-on-surface font-bold`}>{result.projected.averageProcessingMs}ms</td></tr>
              </tbody>
            </table>
          </div>
          <p className="p-space-sm font-kpi-micro text-kpi-micro text-on-surface-variant uppercase">{result.methodology}</p>
        </Panel>
      )}
    </div>
  );
}
