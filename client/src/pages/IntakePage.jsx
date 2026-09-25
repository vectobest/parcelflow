import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
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
// Batch upload is one synchronous request/response with no incremental progress from the server,
// so this names the stage honestly instead of faking a percentage.
const STAGE_LABEL = { reading: 'Reading the file', checking: 'Checking and routing parcels' };
const ACCEPTED = /\.(json|xml)$/i;

function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Parcels riding a conveyor while the batch is read and routed. The server reports no progress, so this
// shows activity and the current stage only -- never a percentage.
function ParcelLoader({ stage, fileName }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-2">
      <div className="conveyor relative w-full max-w-[260px] h-10" aria-hidden="true">
        <span className="conveyor-parcel" />
        <span className="conveyor-parcel" />
        <span className="conveyor-parcel" />
        <span className="conveyor-belt" />
      </div>
      <p className="text-[13px] font-semibold text-on-surface text-center">{STAGE_LABEL[stage]}&hellip;</p>
      {fileName && <p className="text-[12px] text-on-surface-variant -mt-2 truncate max-w-full">{fileName}</p>}
    </div>
  );
}

export default function IntakePage() {
  const [form, setForm] = useState({ id: '', weight: '1.5', value: '120', destinationCountry: 'NL' });
  const [batch, setBatch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const handleError = useApiError();
  const toast = useToast();

  async function routeParcel(event) {
    event.preventDefault();
    setBusy(true);
    setStage('checking');
    try {
      const result = await api('/parcels/route', { body: { parcel: { id: form.id || undefined, weight: Number(form.weight), value: Number(form.value), destinationCountry: form.destinationCountry } } });
      setBatch(result);
      toast('Parcel routed.');
    } catch (error) {
      handleError(error, 'Routing parcel');
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  async function submitBatch(parcels, label) {
    setBusy(true);
    setStage('checking');
    try {
      const result = await api('/batches', { body: { parcels, idempotencyKey: `${label}-${Date.now()}` } });
      setBatch(result);
      toast(result.deduplicated ? 'This batch was already processed.' : `Batch routed: ${result.results.length} parcels under rules ${result.policyVersion}.`, result.state === 'PARTIALLY_FAILED' ? 'warning' : '');
    } catch (error) {
      handleError(error, 'Processing batch');
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  function handleSample() {
    submitBatch(generateSampleBatch(80), 'sample');
  }

  function handleFile(event) {
    uploadFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (!busy) uploadFile(event.dataTransfer.files?.[0]);
  }

  function uploadFile(file) {
    if (!file) return;
    if (!ACCEPTED.test(file.name)) {
      toast(`"${file.name}" isn't a JSON or XML file. Choose a .json or .xml file.`, 'error');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setChosen({ name: file.name, size: file.size });
    const format = file.name.toLowerCase().endsWith('.xml') ? 'xml' : 'json';
    const reader = new FileReader();
    setBusy(true);
    setStage('reading');
    reader.onload = async () => {
      setStage('checking');
      try {
        const result = await api('/batches/upload', { body: { content: reader.result, format, idempotencyKey: `upload-${Date.now()}` } });
        setBatch(result);
        toast(`Uploaded ${file.name}: ${result.results.length} parcels routed.`, result.state === 'PARTIALLY_FAILED' ? 'warning' : '');
      } catch (error) {
        handleError(error, 'Uploading batch');
      } finally {
        setBusy(false);
        setStage(null);
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
            <Button variant="primary" type="submit" disabled={busy} className="w-full py-space-sm mt-space-2xs">Route Parcel</Button>
          </form>
        </Panel>

        <Panel icon="upload_file" title="Batch Upload">
          <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">Upload parcel data as a JSON or XML file. We'll check it before processing.</p>
          <label
            htmlFor="batch-file"
            onDragOver={(e) => { e.preventDefault(); if (!busy) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`drop-zone flex flex-col items-center justify-center text-center gap-1.5 min-h-[168px] px-4 py-5 rounded-lg border-2 border-dashed transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 ${
              busy ? 'cursor-progress border-outline-variant' : 'cursor-pointer'
            } ${dragging ? 'is-dragging border-primary bg-surface-container' : 'border-outline-variant hover:border-on-surface-variant hover:bg-surface-container'}`}
          >
            <input id="batch-file" ref={fileRef} type="file" accept=".json,.xml,application/json,application/xml,text/xml" onChange={handleFile} disabled={busy} className="sr-only" />
            {stage ? (
              <ParcelLoader stage={stage} fileName={chosen?.name} />
            ) : (
              <>
                <Icon name={dragging ? 'move_to_inbox' : 'upload_file'} className="text-[30px] text-on-surface" />
                <span className="text-[14px] font-semibold text-on-surface">{dragging ? 'Drop to upload' : 'Drop a JSON or XML file here'}</span>
                <span className="text-[13px] text-on-surface-variant">or <span className="underline underline-offset-2 text-on-surface">choose a file</span></span>
                <span className="text-[12px] text-on-surface-variant mt-1">Up to 5 MB and 5,000 parcels</span>
                {chosen && (
                  <span className="mt-2 inline-flex items-center gap-1.5 max-w-full rounded-sm bg-surface-container px-2 py-1 text-[12px] text-on-surface">
                    <Icon name="description" className="text-[15px] shrink-0" />
                    <span className="truncate">Last upload: {chosen.name} ({formatSize(chosen.size)})</span>
                  </span>
                )}
              </>
            )}
          </label>
          <Button variant="ghost" type="button" onClick={handleSample} disabled={busy} className="w-full py-space-sm mt-space-sm">
            Generate an 80-Parcel Sample Batch
          </Button>
          <details className="mt-space-sm">
            <summary className="text-[11px] text-on-surface-variant cursor-pointer select-none hover:text-on-surface">Technical details</summary>
            <p className="mt-1.5 font-mono text-[11px] text-on-surface-variant leading-relaxed">JSON or XML, up to 5&nbsp;MB / 5,000 parcels. Parsed and validated on the server before anything is routed.</p>
          </details>
        </Panel>
      </div>

      {batch && (
        <Panel
          icon="fact_check"
          title={`Batch ${batch.batchId.slice(0, 8)}`}
          meta={`${batch.results.length} parcels, rules ${batch.policyVersion}`}
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
                    <td className={td}>
                      {r.parcel.destinationCountry || '—'}
                      {r.parcel.countrySource === 'postal-code' && <span className="block text-[11px] text-on-surface-variant">from postal code</span>}
                    </td>
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
