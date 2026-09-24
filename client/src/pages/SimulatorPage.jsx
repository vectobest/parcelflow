import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { generateSampleBatch } from '../utils/sample.js';
import Badge from '../components/Badge.jsx';

export default function SimulatorPage() {
  const [policies, setPolicies] = useState([]);
  const [candidate, setCandidate] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const handleError = useApiError();

  useEffect(() => {
    api('/policies').then((data) => {
      setPolicies(data.policies);
      const other = data.policies.find((p) => p.version !== data.active.version);
      if (other) setCandidate(other.version);
    }).catch((error) => handleError(error, 'Loading policies'));
  }, [handleError]);

  async function runSimulation() {
    if (!candidate) return;
    setBusy(true);
    try {
      const parcels = generateSampleBatch(150, 42);
      const sim = await api('/simulate', { body: { parcels, candidatePolicyVersion: candidate } });
      setResult(sim);
    } catch (error) {
      handleError(error, 'Simulating');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Impact simulator</h1><p>What-if analysis against a generated sample. Nothing here changes production.</p></div><Badge tone="LOW">What-if mode</Badge></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>Choose a candidate policy</h3></div>
        <div className="button-row" style={{ alignItems: 'center' }}>
          <select value={candidate} onChange={(e) => setCandidate(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Select a policy version</option>
            {policies.map((p) => <option key={p.version} value={p.version}>{p.version} &middot; {p.state}</option>)}
          </select>
          <button className="button primary" type="button" onClick={runSimulation} disabled={!candidate || busy}>Run simulation &rarr;</button>
        </div>
      </article>

      {result && (
        <article className="card">
          <div className="card-head"><h3>{result.currentPolicy} &rarr; {result.candidatePolicy}: {result.changed.length} of {result.total} would change</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Parcel</th><th>Current</th><th>Candidate</th></tr></thead>
              <tbody>
                {result.changed.slice(0, 100).map((c) => (
                  <tr key={c.parcelId}><td className="mono">{c.parcelId}</td><td>{c.oldDecision}</td><td>{c.newDecision}</td></tr>
                ))}
                {result.changed.length === 0 && <tr><td colSpan={3} className="muted">No decisions would change under this candidate.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}
