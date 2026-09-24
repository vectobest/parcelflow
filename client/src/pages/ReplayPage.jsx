import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';

export default function ReplayPage() {
  const [batches, setBatches] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [policyVersion, setPolicyVersion] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const handleError = useApiError();

  useEffect(() => {
    Promise.all([api('/batches?limit=25'), api('/policies')]).then(([batchData, policyData]) => {
      setBatches(batchData.batches);
      setPolicies(policyData.policies);
      if (batchData.batches[0]) setBatchId(batchData.batches[0].batchId);
      const other = policyData.policies.find((p) => p.version !== policyData.active.version) || policyData.active;
      setPolicyVersion(other.version);
    }).catch((error) => handleError(error, 'Loading batches'));
  }, [handleError]);

  async function runReplay() {
    if (!batchId || !policyVersion) return;
    setBusy(true);
    try {
      setResult(await api('/replay', { body: { batchId, policyVersion } }));
    } catch (error) {
      handleError(error, 'Replaying batch');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Decision replay</h1><p>Pick a batch you've already processed and replay it against a different policy version to see what would change. Reproducibility for safe policy evolution.</p></div></div>

      <article className="card" style={{ marginBottom: 20 }}>
        <div className="grid cols-2">
          <div className="field">
            <label>Batch</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Select a batch</option>
              {batches.map((b) => <option key={b.batchId} value={b.batchId}>{b.batchId.slice(0, 8)} &middot; {b.results.length} parcels &middot; policy {b.policyVersion}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Replay against policy</label>
            <select value={policyVersion} onChange={(e) => setPolicyVersion(e.target.value)}>
              {policies.map((p) => <option key={p.version} value={p.version}>{p.version} &middot; {p.state}</option>)}
            </select>
          </div>
        </div>
        <button className="button primary" type="button" onClick={runReplay} disabled={!batchId || busy}>Replay &rarr;</button>
      </article>

      {result && (
        <article className="card">
          <div className="card-head"><h3>{result.originalPolicy} &rarr; {result.replayPolicy}: {result.changed} of {result.total} parcels would change</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Parcel</th><th>Original ({result.originalPolicy})</th><th>Replayed ({result.replayPolicy})</th></tr></thead>
              <tbody>
                {result.changes.slice(0, 100).map((c) => (
                  <tr key={c.parcelId}><td className="mono">{c.parcelId}</td><td>{c.oldDecision}</td><td>{c.newDecision}</td></tr>
                ))}
                {result.changes.length === 0 && <tr><td colSpan={3} className="muted">No decisions changed.</td></tr>}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </div>
  );
}
