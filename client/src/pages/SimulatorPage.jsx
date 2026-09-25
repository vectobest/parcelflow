import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { generateSampleBatch } from '../utils/sample.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Select } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Safe Policy Evolution" title="Impact Simulator" description="What-if analysis against a generated sample. Nothing here changes production." actions={<Badge tone="LOW">What-If Mode</Badge>} />

      <Panel icon="science" title="Choose a Candidate Policy">
        <div className="flex flex-wrap items-center gap-space-sm">
          <Select value={candidate} onChange={(e) => setCandidate(e.target.value)} className="max-w-xs">
            <option value="">Select a policy version</option>
            {policies.map((p) => <option key={p.version} value={p.version}>{p.version} ({p.state.toLowerCase()})</option>)}
          </Select>
          <Button variant="primary" onClick={runSimulation} disabled={!candidate || busy}>Run Simulation</Button>
        </div>
      </Panel>

      {result && (
        <Panel icon="difference" title={`${result.currentPolicy} → ${result.candidatePolicy}: ${result.changed.length} of ${result.total} would change`} bodyClassName="">
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}>Parcel</th><th className={th}>Current</th><th className={th}>Candidate</th></tr></thead>
              <tbody>
                {result.changed.slice(0, 100).map((c) => (
                  <tr key={c.parcelId} className={tr}><td className={`${td} text-on-surface`}>{c.parcelId}</td><td className={td}>{c.oldDecision}</td><td className={td}>{c.newDecision}</td></tr>
                ))}
                {result.changed.length === 0 && <tr><td colSpan={3} className={`${td} text-on-surface-variant`}>No decisions would change under this candidate.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
