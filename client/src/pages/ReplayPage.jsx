import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Select } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Reproducibility" title="Decision Replay" description="Pick a batch you've already processed and replay it against a different policy version to see what would change." />

      <Panel icon="history" title="Replay Configuration">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm mb-space-sm">
          <Field label="Batch">
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Select a batch</option>
              {batches.map((b) => <option key={b.batchId} value={b.batchId}>{b.batchId.slice(0, 8)} &middot; {b.results.length} parcels &middot; policy {b.policyVersion}</option>)}
            </Select>
          </Field>
          <Field label="Replay against policy">
            <Select value={policyVersion} onChange={(e) => setPolicyVersion(e.target.value)}>
              {policies.map((p) => <option key={p.version} value={p.version}>{p.version} &middot; {p.state}</option>)}
            </Select>
          </Field>
        </div>
        <Button variant="primary" onClick={runReplay} disabled={!batchId || busy}>Replay &rarr;</Button>
      </Panel>

      {result && (
        <Panel icon="difference" title={`${result.originalPolicy} → ${result.replayPolicy}: ${result.changed} of ${result.total} would change`} bodyClassName="">
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}>Parcel</th><th className={th}>{`Original (${result.originalPolicy})`}</th><th className={th}>{`Replayed (${result.replayPolicy})`}</th></tr></thead>
              <tbody>
                {result.changes.slice(0, 100).map((c) => (
                  <tr key={c.parcelId} className={tr}><td className={`${td} text-on-surface`}>{c.parcelId}</td><td className={td}>{c.oldDecision}</td><td className={td}>{c.newDecision}</td></tr>
                ))}
                {result.changes.length === 0 && <tr><td colSpan={3} className={`${td} text-on-surface-variant`}>No decisions changed.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
