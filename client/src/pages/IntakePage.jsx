import { useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { generateSampleBatch } from '../utils/sample.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Input } from '../components/Field.jsx';
import { tableWrap, table, thead, th, tr, td } from '../components/table.js';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Step 1" title="Intake" description="Route one parcel, upload a batch file, or generate a sample." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        <Panel icon="local_shipping" title="Single Parcel">
          <form onSubmit={routeParcel} className="flex flex-col gap-space-sm">
            <Field label="Parcel ID (optional)"><Input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-space-sm">
              <Field label="Weight (kg)"><Input type="number" step="0.01" min="0" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required /></Field>
              <Field label="Declared value (EUR)"><Input type="number" step="0.01" min="0" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required /></Field>
            </div>
            <Field label="Destination country"><Input type="text" value={form.destinationCountry} onChange={(e) => setForm({ ...form, destinationCountry: e.target.value })} required /></Field>
            <Button variant="primary" type="submit" disabled={busy} className="w-full py-space-sm mt-space-2xs">Route Parcel &rarr;</Button>
          </form>
        </Panel>

        <Panel icon="upload_file" title="Batch Upload">
          <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">JSON or XML, up to 5&nbsp;MB / 5,000 parcels. Parsed and validated on the server before anything is routed.</p>
          <Field label="Choose a file" htmlFor="batch-file">
            <input id="batch-file" ref={fileRef} type="file" accept=".json,.xml,application/json,application/xml,text/xml" onChange={handleFile} disabled={busy}
              className="w-full font-code-sm text-code-sm text-on-surface-variant file:mr-space-sm file:px-space-sm file:py-space-2xs file:border-0 file:bg-surface-container-highest file:text-on-surface file:uppercase file:font-code-sm file:text-code-sm" />
          </Field>
          <Button variant="ghost" type="button" onClick={handleSample} disabled={busy} className="w-full py-space-sm mt-space-sm">
            Generate an 80-Parcel Sample Batch
          </Button>
        </Panel>
      </div>

      {batch && (
        <Panel
          icon="fact_check"
          title={`Batch ${batch.batchId.slice(0, 8)}`}
          meta={`${batch.results.length} parcels · policy ${batch.policyVersion}`}
          actions={<Badge tone={batch.state === 'COMPLETED' ? 'LOW' : 'MEDIUM'}>{batch.state}</Badge>}
          bodyClassName=""
        >
          <div className={tableWrap}>
            <table className={table}>
              <thead><tr className={thead}><th className={th}>Parcel</th><th className={th}>Weight</th><th className={th}>Value</th><th className={th}>Country</th><th className={th}>Decision</th><th className={th}>Reason</th></tr></thead>
              <tbody>
                {batch.results.slice(0, 100).map((r) => (
                  <tr key={r.id} className={tr}>
                    <td className={`${td} text-on-surface`}>{r.id}</td>
                    <td className={td}>{r.parcel.weight}kg</td>
                    <td className={td}>&euro;{r.parcel.value}</td>
                    <td className={td}>{r.parcel.destinationCountry || '—'}</td>
                    <td className={td}><Badge tone={STATUS_TONE[r.outcome.status]}>{r.outcome.department || r.outcome.decision}</Badge></td>
                    <td className={`${td} text-on-surface-variant`}>{r.outcome.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {batch.results.length > 100 && <p className="p-space-sm font-body-compact text-body-compact text-on-surface-variant">Showing the first 100 of {batch.results.length} parcels.</p>}
        </Panel>
      )}
    </div>
  );
}
