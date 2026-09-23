import { DEFAULT_POLICY, routeBatch } from './src/routing.js';
import { parseUpload } from './src/parser.js';

const form = document.querySelector('#parcel-form');
const fileInput = document.querySelector('#file-input');
const fileName = document.querySelector('#file-name');
const body = document.querySelector('#results-body');
const summary = document.querySelector('#summary');
const message = document.querySelector('#message');
const caption = document.querySelector('#result-caption');
const resultTools = document.querySelector('#result-tools');
const dropZone = document.querySelector('#batch');
const inspector = document.querySelector('#decision-inspector');
const inspectorContent = document.querySelector('#inspector-content');
let currentResults = [];
let activeFilter = 'all';

document.querySelector('#policy-version').textContent = DEFAULT_POLICY.version;

function setMessage(text, type = '') {
  message.textContent = text;
  message.className = `message ${type}`;
}

async function submitParcels(parcels, idempotencyKey) {
  try {
    const response = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': crypto.randomUUID() },
      body: JSON.stringify({ parcels, idempotencyKey })
    });
    if (!response.ok) throw new Error('Server API unavailable.');
    const batch = await response.json();
    render(batch.results);
    setMessage(batch.deduplicated ? 'Duplicate batch detected; showing the original processing result.' : `Batch ${batch.batchId.slice(0, 8)} processed with server-side policy ${batch.policyVersion}.`);
  } catch {
    render(routeBatch(parcels));
    setMessage('Offline preview: the server API was unavailable, so no batch was persisted.', 'error');
  }
}

function render(results) {
  currentResults = results;
  body.replaceChildren();
  const filteredResults = activeFilter === 'all' ? results : results.filter(({ outcome }) => outcome.status === activeFilter);
  const visibleResults = filteredResults.slice(0, 500);
  const counts = results.reduce((all, { outcome }) => {
    all[outcome.status] += 1;
    return all;
  }, { routed: 0, pending: 0, error: 0 });

  summary.hidden = false;
  resultTools.hidden = false;
  summary.replaceChildren();
  [['Routed', counts.routed, 'routed'], ['Needs approval', counts.pending, 'pending'], ['Errors', counts.error, 'error']].forEach(([label, count, className]) => {
    const item = document.createElement('div');
    item.className = `summary-item ${className}`;
    item.innerHTML = `<strong>${count}</strong><span>${label}</span>`;
    summary.append(item);
  });

  visibleResults.forEach(({ id, parcel, outcome }, visibleIndex) => {
    const row = document.createElement('tr');
    row.className = `status-${outcome.status}`;
    row.tabIndex = 0;
    row.setAttribute('aria-label', `Inspect decision for ${id}`);
    row.addEventListener('click', () => showEvidence(filteredResults[visibleIndex]));
    row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') showEvidence(filteredResults[visibleIndex]); });
    const cells = [id, `${parcel.weight} kg`, `€${Number(parcel.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, outcome.department || 'Rejected', outcome.message];
    cells.forEach((value, index) => {
      const cell = document.createElement(index === 4 ? 'td' : 'td');
      cell.textContent = value;
      if (index === 3) cell.className = `decision ${outcome.status}`;
      row.append(cell);
    });
    body.append(row);
  });

  caption.textContent = `${results.length} parcel${results.length === 1 ? '' : 's'} assessed · policy ${DEFAULT_POLICY.version}`;
  setMessage(filteredResults.length > 500 ? 'Showing the first 500 matching results. Summary counts include the full batch.' : `${filteredResults.length} matching result${filteredResults.length === 1 ? '' : 's'} · every decision includes its reason.`);
}

function showEvidence(result) {
  const { id, outcome } = result;
  inspector.hidden = false;
  inspectorContent.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = `${id} · ${outcome.decision}`;
  const reason = document.createElement('p');
  reason.textContent = outcome.reason;
  const evidence = document.createElement('dl');
  [['Status', outcome.status.toUpperCase()], ['Matched rule', outcome.matchedRule], ['Validation', outcome.validation], ['Policy version', outcome.policyVersion], ['Timestamp', outcome.timestamp], ['Evaluated conditions', JSON.stringify(outcome.evaluatedConditions)]].forEach(([label, value]) => {
    const term = document.createElement('dt');
    term.textContent = label;
    const detail = document.createElement('dd');
    detail.textContent = value;
    evidence.append(term, detail);
  });
  inspectorContent.append(title, reason, evidence);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  submitParcels([{ id: 'manual-1', weight: data.get('weight'), value: data.get('value'), destinationCountry: data.get('destinationCountry') }], `manual-${Date.now()}`);
});

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  if (!file) return;
  await processFile(file);
});

async function processFile(file) {
  fileName.textContent = file.name;
  setMessage('Reading batch…');
  try {
    const parcels = await parseUpload(file);
    await submitParcels(parcels, `upload-${file.name}-${file.lastModified}-${file.size}`);
  } catch (error) {
    body.replaceChildren();
    summary.hidden = true;
    caption.textContent = 'Batch could not be assessed.';
    setMessage(error.message, 'error');
  }
}

['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', async (event) => {
  const [file] = event.dataTransfer.files;
  if (file) await processFile(file);
});

document.querySelector('#sample-button').addEventListener('click', () => {
  submitParcels([
    { id: 'PK-1048', weight: 0.6, value: 0, destinationCountry: 'NL' },
    { id: 'PK-1049', weight: 3.2, value: 240, destinationCountry: 'DE' },
    { id: 'PK-1050', weight: 8.4, value: 1250, destinationCountry: 'FR' },
    { id: 'PK-1051', weight: 18, value: 80, destinationCountry: 'BE' }
  ], 'sample-batch-v1');
  fileName.textContent = 'Sample batch · 4 parcels';
});

document.querySelectorAll('.filter').forEach((button) => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item === button));
  if (currentResults.length) render(currentResults);
}));

document.querySelector('#export-button').addEventListener('click', () => {
  const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const rows = currentResults.map(({ id, parcel, outcome }) => [
    id, parcel.weight, parcel.value, parcel.destinationCountry, outcome.status, outcome.department || 'Rejected', outcome.message, outcome.policyVersion
  ]);
  const csv = [['Parcel ID', 'Weight (kg)', 'Value (EUR)', 'Destination', 'Status', 'Decision', 'Reason', 'Policy version'], ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `routing-decisions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

document.querySelector('#clear-button').addEventListener('click', () => {
  body.replaceChildren();
  summary.hidden = true;
  resultTools.hidden = true;
  currentResults = [];
  inspector.hidden = true;
  activeFilter = 'all';
  document.querySelectorAll('.filter').forEach((item) => item.classList.toggle('active', item.dataset.filter === 'all'));
  caption.textContent = 'Waiting for a parcel or batch.';
  setMessage('Results will appear here with the rule that made each decision.');
});

document.querySelector('#close-inspector').addEventListener('click', () => { inspector.hidden = true; });