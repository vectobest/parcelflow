import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { generateSampleBatch } from '../utils/sample.js';
import Badge from '../components/Badge.jsx';

const STATUS_TONE = { routed: 'routed', pending: 'pending', error: 'error', rejected: 'rejected' };

export default function IntakePage() {
  const [form, setForm] = useState({ id: '', weight: '1.5', value: '120', destinationCountry: 'NL' });
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const handleError = useApiError();
  const toast = useToast();

  async function routeParcel(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api('/parcels/route', { body: { parcel: { id: form.id || undefined, weight: Number(form.weight), value: Number(form.value), destinationCountry: form.destinationCountry } } });
      setBatch(result);
      toast('Parcel routed.');
    } catch (error) {
      handleError(error, 'Routing parcel');
    } finally {
      setBusy(false);
    }
  }

  async function submitBatch(parcels, label) {
    setBusy(true);
    try {
      const result = await api('/batches', { body: { parcels, idempotencyKey: `${label}-${Date.now()}` } });
      setBatch(result);
      toast(result.deduplicated ? 'This batch was already processed.' : `Batch routed: ${result.results.length} parcels under policy ${result.policyVersion}.`, result.state === 'PARTIALLY_FAILED' ? 'warning' : '');
    } catch (error) {
      handleError(error, 'Processing batch');
    } finally {
      setBusy(false);
    }
  }

  function handleSample() {
    submitBatch(generateSampleBatch(80), 'sample');
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const format = file.name.endsWith('.xml') ? 'xml' : 'json';
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        const result = await api('/batches/upload', { body: { content: reader.result, format, idempotencyKey: `upload-${Date.now()}` } });
        setBatch(result);
        toast(`Uploaded batch routed: ${result.results.length} parcels.`, result.state === 'PARTIALLY_FAILED' ? 'warning' : '');
      } catch (error) {
        handleError(error, 'Uploading batch');
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="section-head">
        <div><h1>Intake</h1><p>Route one parcel, upload a batch file, or generate a sample.</p></div>
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <article className="card">
          <div className="card-head"><h3>Single parcel</h3></div>
          <form onSubmit={routeParcel}>
            <div className="field"><label>Parcel ID (optional)</label><input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></div>
            <div className="grid cols-2">
              <div className="field"><label>Weight (kg)</label><input type="number" step="0.01" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required /></div>
              <div className="field"><label>Declared value (EUR)</label><input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Destination country</label><input type="text" value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })} required /></div>
            <button className="button primary" type="submit" disabled={busy}>Route parcel &rarr;</button>
          </form>
        </article>

        <article className="card">
          <div className="card-head"><h3>Batch upload</h3></div>
          <p className="muted">JSON or XML, up to 5&nbsp;MB / 5,000 parcels. Parsed and validated on the server before anything is routed.</p>
          <div className="field">
            <label htmlFor="batch-file">Choose a file</label>
            <input id="batch-file" ref={fileRef} type="file" accept=".json,.xml,application/json,application/xml,text/xml" onChange={handleFile} disabled={busy} />
          </div>
          <button className="button ghost" type="button" onClick={handleSample} disabled={busy} style={{ width: '100%' }}>Generate an 80-parcel sample batch</button>
        </article>
      </div>

      {batch && (
        <article className="card">
          <div className="card-head">
            <div><span className="eyebrow">Batch {batch.batchId.slice(0, 8)}</span><h3>{batch.results.length} parcels &middot; policy {batch.policyVersion}</h3></div>
            <Badge tone={batch.state === 'COMPLETED' ? 'LOW' : 'MEDIUM'}>{batch.state}</Badge>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Parcel</th><th>Weight</th><th>Value</th><th>Country</th><th>Decision</th><th>Reason</th></tr></thead>
              <tbody>
                {batch.results.slice(0, 100).map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.id}</td>
                    <td>{r.parcel.weight}kg</td>
                    <td>&euro;{r.parcel.value}</td>
                    <td>{r.parcel.destinationCountry || '—'}</td>
                    <td><span className="decision-tag"><Badge tone={STATUS_TONE[r.outcome.status]}>{r.outcome.department || r.outcome.decision}</Badge></span></td>
                    <td className="muted">{r.outcome.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.results.length > 100 && <p className="muted">Showing the first 100 of {batch.results.length} parcels.</p>}
        </article>
      )}
    </div>
  );
}
