import { useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';

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
    <div>
      <div className="section-head"><div><h1>Digital Twin</h1><p>What-if capacity projection. Never touches production data.</p></div><Badge tone="LOW">Simulation</Badge></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="grid cols-2">
          <div className="field"><label>Volume multiplier (e.g. 1.5 = +50%)</label><input type="number" step="0.1" min="0.1" value={scenario.volumeMultiplier} onChange={(e) => setScenario({ ...scenario, volumeMultiplier: e.target.value })} /></div>
          <div className="field"><label>Processing speed multiplier (0.8 = 20% slower)</label><input type="number" step="0.1" min="0.1" value={scenario.processingSpeedMultiplier} onChange={(e) => setScenario({ ...scenario, processingSpeedMultiplier: e.target.value })} /></div>
          <div className="field"><label>Reviewer capacity multiplier (0.5 = half capacity)</label><input type="number" step="0.1" min="0.1" value={scenario.reviewerCapacityMultiplier} onChange={(e) => setScenario({ ...scenario, reviewerCapacityMultiplier: e.target.value })} /></div>
          <div className="field"><label>Failure rate delta (0.05 = +5 points)</label><input type="number" step="0.01" value={scenario.failureRateDelta} onChange={(e) => setScenario({ ...scenario, failureRateDelta: e.target.value })} /></div>
        </div>
        <button className="button primary" type="button" onClick={run} disabled={busy}>Run projection &rarr;</button>
      </article>

      {result && (
        <article className="card">
          <div className="card-head"><h3>{result.label}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th></th><th>Current</th><th>Projected</th></tr></thead>
              <tbody>
                <tr><td>Parcels</td><td>{result.current.parcels}</td><td><strong>{result.projected.parcels}</strong></td></tr>
                <tr><td>Approval queue</td><td>{result.current.approvals}</td><td><strong>{result.projected.approvals}</strong></td></tr>
                <tr><td>Failure rate</td><td>{(result.current.failureRate * 100).toFixed(1)}%</td><td><strong>{(result.projected.failureRate * 100).toFixed(1)}%</strong></td></tr>
                <tr><td>Avg. processing time</td><td>{result.current.averageProcessingMs}ms</td><td><strong>{result.projected.averageProcessingMs}ms</strong></td></tr>
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>{result.methodology}</p>
        </article>
      )}
    </div>
  );
}
