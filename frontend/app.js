import { DEFAULT_POLICY, routeBatch } from '../backend/src/routing.js';
import { parseUpload } from './parser.js';
import { api, ApiError, OfflineError, loadIdentity, saveIdentity } from './api.js';
import { generateSampleBatch } from './sample.js';
import {
  h, mount, colorFor, decisionRank, formatKg, formatEur,
  sparkline, donutChart, stackedBar, riskGauge, scatterChart, histogramChart, flowChart, compareBars, policyRuler
} from './charts.js';

const $ = (selector) => document.querySelector(selector);
const PAGE_SIZE = 25;
const STATUS_META = {
  routed: { label: 'Routed', color: 'var(--c-routed)' },
  pending: { label: 'Needs approval', color: 'var(--c-pending)' },
  error: { label: 'Validation errors', color: 'var(--c-error)' },
  rejected: { label: 'Insurance rejected', color: 'var(--c-rejected)' }
};

const state = {
  policy: DEFAULT_POLICY,
  policies: [],
  dashboard: null,
  risk: null,
  approvals: [],
  results: [],
  batch: null,
  history: [],
  activity: [],
  audit: [],
  auditAccess: 'unknown',
  filter: 'all',
  search: '',
  page: 0,
  selected: null,
  connection: 'checking'
};

const fmt = (value) => Number(value).toLocaleString('en-US');
const decisionOf = (outcome) => outcome.department || outcome.decision || 'Rejected';
const timeNow = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function statusOf(outcome) {
  if (outcome.status === 'rejected' || outcome.matchedRule === 'INSURANCE_REJECTED') return 'rejected';
  return STATUS_META[outcome.status] ? outcome.status : 'error';
}

function summarize(results) {
  const summary = { total: results.length, routed: 0, pending: 0, error: 0, rejected: 0, departments: {} };
  for (const { outcome } of results) {
    summary[statusOf(outcome)] += 1;
    if (outcome.department) summary.departments[outcome.department] = (summary.departments[outcome.department] || 0) + 1;
  }
  return summary;
}

function hasThresholds(policy) {
  return Number.isFinite(Number(policy?.mailWeightLimit)) && Number.isFinite(Number(policy?.regularWeightLimit));
}

function weightBands(policy) {
  if (!hasThresholds(policy)) return [];
  const departments = policy.departments || {};
  return [
    { from: 0, to: Number(policy.mailWeightLimit), label: (departments.mail || 'Mail Department').replace(' Department', ''), color: colorFor(departments.mail || 'Mail Department') },
    { from: Number(policy.mailWeightLimit), to: Number(policy.regularWeightLimit), label: (departments.regular || 'Regular Department').replace(' Department', ''), color: colorFor(departments.regular || 'Regular Department') },
    { from: Number(policy.regularWeightLimit), to: null, label: (departments.heavy || 'Heavy Department').replace(' Department', ''), color: colorFor(departments.heavy || 'Heavy Department') }
  ];
}

/* ---------- feedback ---------- */

function toast(message, type = '') {
  const node = h('div', { class: `toast ${type}`, role: type === 'error' ? 'alert' : 'status', text: message });
  $('#toasts').append(node);
  setTimeout(() => node.remove(), type === 'error' ? 7000 : 4000);
}

function setNotice(message, type = '') {
  const notice = $('#notice');
  notice.hidden = !message;
  notice.className = `notice ${type}`;
  notice.textContent = message || '';
}

function addActivity(label, detail, kind = '') {
  state.activity.unshift({ time: timeNow(), label, detail, kind });
  state.activity = state.activity.slice(0, 40);
  renderActivity();
}

function setConnection(connection) {
  state.connection = connection;
  const pill = $('#connection-pill');
  pill.dataset.state = connection;
  $('#connection-text').textContent = { online: 'Live', offline: 'Offline preview', auth: 'Sign in required', checking: 'Connecting…' }[connection];
}

let identityPrompted = false;
function handleApiError(error, context) {
  if (error instanceof OfflineError) {
    setConnection('offline');
    return;
  }
  if (error instanceof ApiError && error.status === 401) {
    setConnection('auth');
    if (!identityPrompted) {
      identityPrompted = true;
      openIdentityDialog('Your session needs an identity before the server will answer.');
    }
    return;
  }
  if (error instanceof ApiError && error.status === 403) {
    toast(`${context}: your role is not allowed to do this. Switch identity to continue.`, 'error');
    return;
  }
  toast(`${context}: ${error.message}`, 'error');
}

/* ---------- server data ---------- */

async function refreshServerData() {
  const [dashboard, risk, approvals, policies, audit] = await Promise.allSettled([
    api('/api/dashboard'), api('/api/risk'), api('/api/approvals'), api('/api/policies'), api('/api/audit')
  ]);
  const failures = [dashboard, risk, approvals, policies].filter((result) => result.status === 'rejected');
  if (failures.length === 4) handleApiError(failures[0].reason, 'Refresh');
  else setConnection('online');

  if (dashboard.status === 'fulfilled') state.dashboard = dashboard.value;
  if (risk.status === 'fulfilled') state.risk = risk.value;
  if (approvals.status === 'fulfilled') state.approvals = Array.isArray(approvals.value) ? approvals.value : [];
  if (policies.status === 'fulfilled') {
    const previous = state.policy.version;
    state.policy = policies.value?.active || state.policy;
    state.policies = policies.value?.policies || [];
    if (previous !== state.policy.version) resetSimulator();
  }
  if (audit.status === 'fulfilled') {
    state.audit = Array.isArray(audit.value) ? audit.value : [];
    state.auditAccess = 'granted';
  } else if (audit.reason instanceof ApiError && audit.reason.status === 403) {
    state.auditAccess = 'denied';
  }
  renderOverview();
  renderRisk();
  renderApprovals();
  renderPolicy();
  renderReplay();
  renderAudit();
}

async function refreshHealth() {
  try {
    const response = await fetch('/health');
    const health = await response.json();
    const minutes = Math.floor((health.uptime || 0) / 60);
    $('#health-text').textContent = `System ${health.status} · v${health.version} · up ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}`;
  } catch {
    $('#health-text').textContent = 'System health unavailable. Decisions shown are local previews.';
  }
}

/* ---------- processing ---------- */

async function submitParcels(parcels, idempotencyKey, label) {
  setNotice('Routing parcels…');
  try {
    const batch = await api('/api/batches', { method: 'POST', body: { parcels, idempotencyKey } });
    setConnection('online');
    state.batch = { batchId: batch.batchId, policyVersion: batch.policyVersion, deduplicated: batch.deduplicated, offline: false, label };
    showResults(batch.results);
    const summary = summarize(batch.results);
    if (!batch.deduplicated) state.history.push({ ...summary, at: Date.now() });
    setNotice(batch.deduplicated
      ? 'This batch was already processed, so the original result is shown and nothing was routed twice.'
      : `Batch ${batch.batchId.slice(0, 8)} routed under policy ${batch.policyVersion}.`, batch.deduplicated ? 'warning' : '');
    addActivity(batch.deduplicated ? 'Duplicate batch ignored' : `${label} routed`, `${fmt(summary.total)} parcels · ${summary.routed} routed · ${summary.pending} pending · ${summary.error} errors`, summary.error ? 'error' : summary.pending ? 'pending' : 'routed');
    await refreshServerData();
    return true;
  } catch (error) {
    if (error instanceof OfflineError) {
      setConnection('offline');
      state.batch = { offline: true, policyVersion: state.policy.version, label };
      const results = routeBatch(parcels, state.policy);
      showResults(results);
      state.history.push({ ...summarize(results), at: Date.now() });
      renderOverview();
      setNotice('The server is unreachable. These are local previews only and were not recorded.', 'warning');
      addActivity(`${label} previewed offline`, `${fmt(results.length)} parcels · not persisted`, 'pending');
      return true;
    }
    setNotice(`${label} was not processed: ${error.message}`, 'error');
    handleApiError(error, label);
    return false;
  }
}

function showResults(results) {
  state.results = results;
  state.filter = 'all';
  state.search = '';
  state.page = 0;
  $('#search-input').value = '';
  renderOutcomes();
  scheduleSimulation();
}

/* ---------- overview ---------- */

function overviewTotals() {
  const dashboard = state.dashboard;
  if (dashboard && state.connection !== 'offline') {
    const rejected = state.approvals.filter((approval) => approval.state === 'REJECTED').length;
    return { total: dashboard.totalParcels, routed: dashboard.successful, pending: dashboard.pendingApproval, error: dashboard.validationErrors, rejected, departments: dashboard.departmentDistribution || {}, averageMs: dashboard.averageProcessingMs };
  }
  return state.history.reduce((totals, batch) => {
    for (const key of ['total', 'routed', 'pending', 'error', 'rejected']) totals[key] += batch[key];
    for (const [name, count] of Object.entries(batch.departments)) totals.departments[name] = (totals.departments[name] || 0) + count;
    return totals;
  }, { total: 0, routed: 0, pending: 0, error: 0, rejected: 0, departments: {}, averageMs: null });
}

function renderOverview() {
  const totals = overviewTotals();
  const last = state.history.at(-1);
  const kpis = [['total', totals.total, 'var(--accent)'], ['routed', totals.routed, 'var(--c-routed)'], ['pending', totals.pending, 'var(--c-pending)'], ['error', totals.error, 'var(--c-error)']];
  for (const [key, value, color] of kpis) {
    $(`#kpi-${key}`).textContent = fmt(value);
    const delta = $(`#kpi-${key}-delta`);
    if (last) {
      delta.textContent = `+${fmt(last[key])} in last batch`;
      delta.classList.toggle('up', key === 'routed' && last[key] > 0);
    }
    mount($(`#spark-${key}`), sparkline(state.history.slice(-12).map((batch) => batch[key]), color));
  }

  const attention = totals.pending + totals.error;
  $('#overview-lede').textContent = totals.total
    ? `${fmt(totals.total)} parcels processed this session. ${attention ? `${fmt(attention)} need a person: ${fmt(totals.pending)} awaiting insurance approval, ${fmt(totals.error)} with invalid data.` : 'Everything is flowing cleanly.'}`
    : 'Load a batch or route a single parcel to see decisions, workload and risk in one place.';

  $('#outcome-mix').replaceChildren(stackedBar(['routed', 'pending', 'error', 'rejected']
    .filter((key) => key !== 'rejected' || totals.rejected)
    .map((key) => ({ label: STATUS_META[key].label, value: totals[key], color: STATUS_META[key].color }))));
  const routedRate = totals.total ? Math.round((totals.routed / totals.total) * 100) : 0;
  $('#mini-stats').replaceChildren(
    h('div', { class: 'mini-stat' }, h('span', { text: 'Straight-through' }), h('strong', { text: totals.total ? `${routedRate}%` : '—' })),
    h('div', { class: 'mini-stat' }, h('span', { text: 'Batches' }), h('strong', { text: fmt(state.history.length) })),
    h('div', { class: 'mini-stat' }, h('span', { text: 'Avg. batch time' }), h('strong', { text: totals.averageMs === null || totals.averageMs === undefined ? '—' : `${fmt(totals.averageMs)} ms` }))
  );

  const segments = Object.entries(totals.departments)
    .sort(([a], [b]) => decisionRank(a) - decisionRank(b))
    .map(([label, value]) => ({ label, value, color: colorFor(label) }));
  const departmentTotal = segments.reduce((sum, segment) => sum + segment.value, 0);
  $('#department-donut').replaceChildren(donutChart(segments, { centerValue: fmt(departmentTotal), centerLabel: 'parcels' }));
  $('#department-legend').replaceChildren(...(segments.length
    ? segments.map((segment) => h('span', { class: 'legend-item' }, h('i', { style: { background: segment.color } }), h('span', { text: segment.label }), h('strong', { text: fmt(segment.value) })))
    : [h('span', { class: 'muted', text: 'No parcels routed yet.' })]));
}

function renderRisk() {
  const risk = state.risk;
  if (!risk) return;
  const badge = $('#risk-badge');
  badge.textContent = risk.level.replaceAll('_', ' ');
  badge.className = `badge ${risk.level.toLowerCase()}`;
  $('#risk-gauge').replaceChildren(riskGauge(risk.level));
  $('#risk-message').textContent = risk.title || risk.message;
  $('#risk-evidence').replaceChildren(...(risk.evidence || []).map((item) => h('li', { text: item })));
  $('#risk-recommendation').textContent = risk.recommendation;
}

/* ---------- outcomes ---------- */

function filteredResults() {
  const query = state.search.trim().toLowerCase();
  return state.results.filter(({ id, parcel, outcome }) => {
    if (state.filter !== 'all' && statusOf(outcome) !== state.filter) return false;
    if (!query) return true;
    return [id, parcel?.destinationCountry, decisionOf(outcome), outcome.reason].some((field) => String(field ?? '').toLowerCase().includes(query));
  });
}

function renderOutcomes() {
  const hasResults = state.results.length > 0;
  $('#outcomes-empty').hidden = hasResults;
  $('#outcomes-body').hidden = !hasResults;
  $('#export-button').disabled = !hasResults;
  $('#clear-button').disabled = !hasResults;
  if (!hasResults) {
    $('#outcomes-caption').textContent = 'Waiting for a parcel or batch.';
    return;
  }
  const summary = summarize(state.results);
  const batch = state.batch || {};
  $('#outcomes-caption').textContent = `${fmt(summary.total)} parcel${summary.total === 1 ? '' : 's'} · ${batch.label || 'batch'} · policy ${batch.policyVersion || state.policy.version}${batch.offline ? ' · offline preview' : ''}`;

  const chips = [['all', 'All', 'var(--ink)', summary.total], ...['routed', 'pending', 'error', 'rejected'].filter((key) => key !== 'rejected' || summary.rejected).map((key) => [key, STATUS_META[key].label, STATUS_META[key].color, summary[key]])];
  $('#filter-chips').replaceChildren(...chips.map(([key, label, color, count]) => h('button', {
    class: 'chip', type: 'button', 'aria-pressed': String(state.filter === key),
    onclick: () => { state.filter = key; state.page = 0; renderOutcomes(); }
  }, key === 'all' ? null : h('i', { style: { background: color } }), h('span', { text: label }), h('strong', { text: fmt(count) }))));

  const valid = state.results
    .map((result) => ({ result, weight: Number(result.parcel?.weight), value: Number(result.parcel?.value) }))
    .filter(({ weight, value }) => Number.isFinite(weight) && weight >= 0 && Number.isFinite(value) && value >= 0);
  const policy = policyForBatch();
  const threshold = Number(policy.insuranceValueThreshold);
  mount($('#scatter'), scatterChart({
    points: valid.map(({ result, weight, value }) => ({
      weight, value, color: colorFor(decisionOf(result.outcome)), ring: state.selected === result, data: result,
      lines: [result.id, `${formatKg(weight)} · ${formatEur(value)} · ${result.parcel?.destinationCountry || '—'}`, decisionOf(result.outcome)]
    })),
    bands: weightBands(policy),
    hLines: Number.isFinite(threshold) ? [{ value: threshold, label: `Insurance > ${formatEur(threshold)}` }] : [],
    onSelect: inspect
  }));
  const bands = weightBands(policy);
  mount($('#histogram'), histogramChart({
    values: valid.map(({ weight }) => weight),
    bands: bands.map((band) => ({ ...band, from: band.from === 0 ? -Infinity : band.from, to: band.to ?? Infinity })),
    markers: bands.slice(1).map((band) => ({ value: band.from, label: formatKg(band.from) }))
  }));
  $('#band-legend').replaceChildren(...bands.map((band) => h('span', { class: 'legend-item' }, h('i', { style: { background: band.color } }), h('span', { text: `${band.label} ${band.to === null ? `> ${formatKg(band.from)}` : `≤ ${formatKg(band.to)}`}` }))));

  renderTable();
}

function renderTable() {
  const rows = filteredResults();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const visible = rows.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE);
  const body = $('#results-body');
  body.replaceChildren(...visible.map((result) => {
    const { id, parcel, outcome } = result;
    const decision = decisionOf(outcome);
    const open = () => inspect(result);
    return h('tr', {
      tabindex: '0', class: state.selected === result ? 'selected' : '', 'aria-label': `Inspect decision for ${id}`,
      onclick: open, onkeydown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }
    },
    h('td', {}, h('strong', { text: id })),
    h('td', { class: 'num', text: Number.isFinite(Number(parcel?.weight)) ? formatKg(parcel.weight) : String(parcel?.weight ?? '—') }),
    h('td', { class: 'num', text: Number.isFinite(Number(parcel?.value)) ? formatEur(parcel.value) : String(parcel?.value ?? '—') }),
    h('td', { text: parcel?.destinationCountry || '—' }),
    h('td', {}, h('span', { class: 'decision-tag' }, h('i', { style: { background: colorFor(decision) } }), decision)),
    h('td', { class: 'reason hide-sm', text: outcome.reason || outcome.message }));
  }));
  if (!visible.length) body.append(h('tr', {}, h('td', { colspan: '6', class: 'muted', text: 'No parcels match this filter.' })));

  const start = rows.length ? state.page * PAGE_SIZE + 1 : 0;
  $('#pager').replaceChildren(
    h('span', { text: `${fmt(start)}–${fmt(Math.min((state.page + 1) * PAGE_SIZE, rows.length))} of ${fmt(rows.length)}` }),
    h('div', {},
      h('button', { class: 'button small ghost', type: 'button', disabled: state.page === 0, onclick: () => { state.page -= 1; renderTable(); } }, '← Previous'),
      h('button', { class: 'button small ghost', type: 'button', disabled: state.page >= pages - 1, onclick: () => { state.page += 1; renderTable(); } }, 'Next →'))
  );
}

function policyForBatch() {
  const version = state.batch?.policyVersion;
  return state.policies.find((policy) => policy.version === version) || state.policy;
}

/* ---------- inspector ---------- */

function inspect(result) {
  state.selected = result;
  const { id, parcel, outcome } = result;
  const status = statusOf(outcome);
  const decision = decisionOf(outcome);
  const policy = state.policies.find((item) => item.version === outcome.policyVersion) || state.policy;
  const threshold = Number(outcome.evaluatedConditions?.insuranceThreshold ?? policy.insuranceValueThreshold);
  const value = Number(parcel?.value);

  const steps = [];
  if (status === 'error') {
    steps.push(['failed', '!', 'Validation failed', outcome.reason]);
    steps.push(['blocked', '–', 'Routing not attempted', 'Correct the parcel data and resubmit it.']);
  } else {
    steps.push(['passed', '✓', 'Parcel data validated', 'Weight, value and destination are present and well-formed.']);
    if (status === 'pending') {
      steps.push(['blocked', '!', 'Insurance threshold exceeded', `${formatEur(value)} is above ${formatEur(threshold)}.`]);
      steps.push(['blocked', '…', 'Waiting for a reviewer', 'Department routing resumes after approval.']);
    } else if (status === 'rejected') {
      steps.push(['failed', '×', 'Insurance rejected', outcome.reason]);
    } else {
      steps.push(['passed', '✓', 'Insurance check', value > threshold ? 'Approved by a reviewer.' : `${formatEur(value)} is within the ${formatEur(threshold)} threshold.`]);
      steps.push(['passed', '✓', `Rule ${outcome.matchedRule}`, outcome.reason]);
    }
  }

  const approval = status === 'pending' ? state.approvals.find((item) => item.parcelId === id && item.state === 'PENDING_APPROVAL' && (!state.batch?.batchId || item.batchId === state.batch.batchId)) : null;
  $('#inspector-title').textContent = id;
  $('#inspector-body').replaceChildren(
    h('div', { class: 'verdict', style: { background: `color-mix(in srgb, ${colorFor(decision)} 14%, var(--surface))` } },
      h('i', { style: { background: colorFor(decision) } }),
      h('div', {}, h('strong', { text: decision }), h('span', { text: outcome.message || outcome.reason }))),
    h('div', { class: 'steps' }, steps.map(([kind, mark, title, detail]) => h('div', { class: `step ${kind}` }, h('span', { class: 'step-mark', text: mark }), h('div', {}, h('strong', { text: title }), h('small', { text: detail }))))),
    approval ? h('div', { class: 'button-row' },
      h('button', { class: 'button danger', type: 'button', onclick: () => decideApproval(approval, 'reject') }, 'Reject'),
      h('button', { class: 'button primary', type: 'button', onclick: () => decideApproval(approval, 'approve') }, 'Approve & route')) : null,
    h('dl', { class: 'facts' }, [
      ['Weight', Number.isFinite(Number(parcel?.weight)) ? formatKg(parcel.weight) : String(parcel?.weight ?? '—')],
      ['Value', Number.isFinite(value) ? formatEur(value) : String(parcel?.value ?? '—')],
      ['Destination', parcel?.destinationCountry || '—'],
      ['Status', status.toUpperCase()],
      ['Matched rule', outcome.matchedRule],
      ['Policy', outcome.policyVersion],
      ['Decided at', outcome.timestamp ? new Date(outcome.timestamp).toLocaleString() : '—'],
      ['Conditions', JSON.stringify(outcome.evaluatedConditions || {})]
    ].flatMap(([term, detail]) => [h('dt', { text: term }), h('dd', { text: String(detail ?? '—') })]))
  );
  $('#inspector').hidden = false;
  renderTable();
}

function closeInspector() {
  $('#inspector').hidden = true;
  state.selected = null;
  if (state.results.length) renderTable();
}

/* ---------- approvals ---------- */

function renderApprovals() {
  const pending = state.approvals.filter((approval) => approval.state === 'PENDING_APPROVAL');
  const decided = state.approvals.filter((approval) => approval.state !== 'PENDING_APPROVAL').slice(-6).reverse();
  $('#approvals-count').textContent = `${fmt(pending.length)} pending`;
  const badge = $('#nav-approvals');
  badge.hidden = !pending.length;
  badge.textContent = pending.length;

  const list = $('#approval-list');
  if (!pending.length && !decided.length) {
    list.replaceChildren(h('div', { class: 'empty-state' }, h('span', { text: '✓' }), h('p', { text: 'No parcels are waiting for insurance approval.' })));
    return;
  }
  const threshold = Number(state.policy.insuranceValueThreshold) || 1;
  list.replaceChildren(...[...pending, ...decided].map((approval) => {
    const parcel = approval.parcel || {};
    const value = Number(parcel.value);
    const isPending = approval.state === 'PENDING_APPROVAL';
    return h('article', { class: `approval ${isPending ? '' : 'decided'}` },
      h('div', { class: 'approval-head' }, h('strong', { text: approval.parcelId }), h('span', { class: `state ${isPending ? '' : approval.state === 'APPROVED' ? 'ACTIVE' : 'ROLLED_BACK'}`, text: isPending ? 'PENDING' : approval.state })),
      h('div', {}, h('div', { class: 'approval-value', text: formatEur(value) }), h('small', { class: 'muted', text: `${(value / threshold).toFixed(1)}× the ${formatEur(threshold)} threshold` })),
      h('div', { class: 'approval-bar', role: 'presentation' }, h('i', { style: { width: `${Math.min((threshold / Math.max(value, 1)) * 100, 100)}%` } })),
      h('div', { class: 'approval-meta' },
        h('span', { text: formatKg(parcel.weight ?? 0) }),
        h('span', { text: parcel.destinationCountry || '—' }),
        h('span', { text: `Policy ${approval.policyVersion}` }),
        h('span', { text: isPending ? `Waiting since ${new Date(approval.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `By ${approval.decidedBy || 'reviewer'}` })),
      isPending ? h('div', { class: 'button-row' },
        h('button', { class: 'button danger small', type: 'button', onclick: () => decideApproval(approval, 'reject') }, 'Reject'),
        h('button', { class: 'button primary small', type: 'button', onclick: () => decideApproval(approval, 'approve') }, 'Approve')) : null);
  }));
}

async function decideApproval(approval, action) {
  try {
    const result = await api(`/api/approvals/${encodeURIComponent(approval.approvalId)}/${action}`, { method: 'POST', body: {} });
    const index = state.results.findIndex((item) => item.id === approval.parcelId && statusOf(item.outcome) === 'pending' && (!state.batch?.batchId || state.batch.batchId === approval.batchId));
    if (index !== -1 && result?.outcome) state.results[index] = { ...state.results[index], outcome: result.outcome };
    toast(action === 'approve' ? `${approval.parcelId} approved and routed to ${result?.outcome?.department || 'its department'}.` : `${approval.parcelId} rejected.`);
    addActivity(action === 'approve' ? 'Insurance approved' : 'Insurance rejected', `${approval.parcelId} · ${formatEur(approval.parcel?.value ?? 0)}`, action === 'approve' ? 'routed' : 'error');
    await refreshServerData();
    renderOutcomes();
    if (state.selected?.id === approval.parcelId && index !== -1) inspect(state.results[index]);
  } catch (error) {
    handleApiError(error, action === 'approve' ? 'Approval' : 'Rejection');
  }
}

/* ---------- simulator ---------- */

const sliders = {
  mailWeightLimit: { input: $('#sim-mail'), output: $('#sim-mail-out'), base: $('#sim-mail-base'), format: formatKg },
  regularWeightLimit: { input: $('#sim-regular'), output: $('#sim-regular-out'), base: $('#sim-regular-base'), format: formatKg },
  insuranceValueThreshold: { input: $('#sim-insurance'), output: $('#sim-insurance-out'), base: $('#sim-insurance-base'), format: formatEur }
};
let simulationSample = null;

function resetSimulator() {
  for (const [key, slider] of Object.entries(sliders)) {
    const current = Number(state.policy[key] ?? DEFAULT_POLICY[key]);
    slider.input.max = Math.max(Number(slider.input.max), current * 2);
    slider.input.value = current;
    slider.base.textContent = `Active ${state.policy.version}: ${slider.format(current)}`;
  }
  scheduleSimulation();
}

function candidatePolicy() {
  return {
    ...state.policy,
    version: 'candidate',
    mailWeightLimit: Number(sliders.mailWeightLimit.input.value),
    regularWeightLimit: Number(sliders.regularWeightLimit.input.value),
    insuranceValueThreshold: Number(sliders.insuranceValueThreshold.input.value),
    departments: state.policy.departments || DEFAULT_POLICY.departments
  };
}

let simulationFrame = 0;
function scheduleSimulation() {
  cancelAnimationFrame(simulationFrame);
  simulationFrame = requestAnimationFrame(runSimulation);
}

function runSimulation() {
  const candidate = candidatePolicy();
  for (const [key, slider] of Object.entries(sliders)) {
    slider.output.textContent = slider.format(candidate[key]);
    slider.output.classList.toggle('changed', Number(candidate[key]) !== Number(state.policy[key]));
  }
  let parcels = state.results.map(({ parcel }) => parcel);
  if (parcels.length) {
    $('#sim-source').textContent = `Replaying the ${fmt(parcels.length)} parcels currently in Outcomes.`;
  } else {
    simulationSample ||= generateSampleBatch({ size: 160, seed: 42 });
    parcels = simulationSample;
    $('#sim-source').textContent = 'Using a generated 160-parcel sample. Process a real batch to simulate against your own data.';
  }
  const invalidCandidate = candidate.mailWeightLimit >= candidate.regularWeightLimit;
  $('#sim-draft').disabled = invalidCandidate;
  if (invalidCandidate) $('#sim-source').textContent = 'The mail limit must stay below the regular limit. This candidate could never be activated.';

  const current = hasThresholds(state.policy) ? state.policy : DEFAULT_POLICY;
  const before = routeBatch(parcels, current);
  const after = routeBatch(parcels, candidate);
  const rows = after.map((item, index) => ({ id: item.id, parcel: item.parcel, before: decisionOf(before[index].outcome), after: decisionOf(item.outcome) }));
  const changes = rows.filter((row) => row.before !== row.after);

  const count = (key, name) => rows.filter((row) => row[key] === name).length;
  const names = [...new Set(rows.flatMap((row) => [row.before, row.after]))].sort((a, b) => decisionRank(a) - decisionRank(b));
  const approvalsBefore = count('before', 'Insurance Approval');
  const approvalsAfter = count('after', 'Insurance Approval');
  const shifts = names.filter((name) => name !== 'Insurance Approval' && name !== 'Rejected').map((name) => ({ name, delta: count('after', name) - count('before', name) }));
  const biggest = shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const approvalDelta = approvalsAfter - approvalsBefore;

  $('#impact-grid').replaceChildren(
    h('div', { class: `impact ${changes.length ? 'alert' : 'good'}` }, h('span', { text: 'Decisions changed' }), h('strong', { text: fmt(changes.length) }), h('small', { text: `${rows.length ? ((changes.length / rows.length) * 100).toFixed(1) : 0}% of ${fmt(rows.length)} parcels` })),
    h('div', { class: `impact ${approvalDelta > 0 ? 'alert' : approvalDelta < 0 ? 'good' : ''}` }, h('span', { text: 'Approval queue' }), h('strong', { text: approvalDelta > 0 ? `+${approvalDelta}` : String(approvalDelta) }), h('small', { text: `${approvalsBefore} → ${approvalsAfter} parcels need a reviewer` })),
    h('div', { class: 'impact' }, h('span', { text: 'Largest shift' }), h('strong', { text: biggest && biggest.delta ? `${biggest.delta > 0 ? '+' : ''}${biggest.delta}` : '±0' }), h('small', { text: biggest && biggest.delta ? biggest.name : 'Department loads unchanged' })),
    h('div', { class: 'impact good' }, h('span', { text: 'Unchanged' }), h('strong', { text: fmt(rows.length - changes.length) }), h('small', { text: 'Same decision under both policies' }))
  );

  const links = new Map();
  for (const row of rows) {
    const key = `${row.before}→${row.after}`;
    links.set(key, { from: row.before, to: row.after, count: (links.get(key)?.count || 0) + 1 });
  }
  mount($('#sim-flow'), flowChart([...links.values()]));
  $('#sim-bars').replaceChildren(compareBars(names.map((name) => ({ label: name.replace(' Department', ''), before: count('before', name), after: count('after', name), color: colorFor(name) }))));

  const changedIds = new Set(changes.map((change) => change.id));
  mount($('#sim-scatter'), scatterChart({
    points: rows.filter(({ parcel }) => Number.isFinite(Number(parcel?.weight)) && Number(parcel.weight) >= 0 && Number.isFinite(Number(parcel?.value)))
      .map(({ id, parcel, before: was, after: now }) => ({
        weight: Number(parcel.weight), value: Number(parcel.value), color: colorFor(now), ring: changedIds.has(id),
        lines: [id, `${formatKg(parcel.weight)} · ${formatEur(parcel.value)}`, was === now ? now : `${was} → ${now}`]
      })),
    bands: weightBands(candidate),
    vLines: [
      { value: Number(current.mailWeightLimit), label: `now ${formatKg(current.mailWeightLimit)}`, variant: 'current' },
      { value: Number(current.regularWeightLimit), label: `now ${formatKg(current.regularWeightLimit)}`, variant: 'current' },
      { value: candidate.mailWeightLimit, label: formatKg(candidate.mailWeightLimit), variant: 'candidate' },
      { value: candidate.regularWeightLimit, label: formatKg(candidate.regularWeightLimit), variant: 'candidate' }
    ],
    hLines: [
      { value: Number(current.insuranceValueThreshold), label: `now ${formatEur(current.insuranceValueThreshold)}`, variant: 'current' },
      { value: candidate.insuranceValueThreshold, label: `candidate ${formatEur(candidate.insuranceValueThreshold)}`, variant: 'candidate' }
    ],
    label: 'Parcels plotted by weight and value with current and candidate thresholds'
  }));

  $('#sim-changes-title').textContent = changes.length ? `${fmt(changes.length)} parcel${changes.length === 1 ? '' : 's'} would be routed differently` : 'No decisions change under this candidate';
  const shown = changes.slice(0, 100);
  $('#sim-changes').replaceChildren(...(shown.length ? shown.map(({ id, parcel, before: was, after: now }) => h('tr', {},
    h('td', {}, h('strong', { text: id })),
    h('td', { class: 'num', text: formatKg(parcel.weight) }),
    h('td', { class: 'num', text: formatEur(parcel.value) }),
    h('td', {}, h('span', { class: 'decision-tag' }, h('i', { style: { background: colorFor(was) } }), was)),
    h('td', {}, h('span', { class: 'decision-tag' }, h('i', { style: { background: colorFor(now) } }), now))))
    : [h('tr', {}, h('td', { colspan: '5', class: 'muted', text: 'Move a slider to see which parcels would change.' }))]));
  if (changes.length > shown.length) $('#sim-changes').append(h('tr', {}, h('td', { colspan: '5', class: 'muted', text: `…and ${fmt(changes.length - shown.length)} more.` })));
}

async function saveDraftPolicy() {
  const candidate = candidatePolicy();
  const version = `${state.policy.version}-draft-${Date.now().toString(36)}`;
  const { state: _state, createdAt, activatedAt, ...base } = candidate;
  try {
    await api('/api/policies', { method: 'POST', body: { ...base, version } });
    toast(`Draft ${version} saved. A reviewer must validate and approve it before it can go live.`);
    addActivity('Policy draft created', `${version} · mail ${formatKg(candidate.mailWeightLimit)} · regular ${formatKg(candidate.regularWeightLimit)} · insurance ${formatEur(candidate.insuranceValueThreshold)}`);
    await refreshServerData();
  } catch (error) {
    handleApiError(error, 'Saving draft');
  }
}

/* ---------- policy & activity ---------- */

const NEXT_POLICY_ACTION = {
  DRAFT: ['validate', 'Validate'],
  VALIDATED: ['approve', 'Approve'],
  APPROVED: ['activate', 'Activate'],
  ACTIVE: ['rollback', 'Roll back']
};

function policyActionButton(policy) {
  const next = NEXT_POLICY_ACTION[policy.state];
  if (!next) return null;
  const [action, label] = next;
  return h('button', { class: `button small ${action === 'rollback' ? 'ghost' : 'primary'}`, type: 'button', onclick: () => policyAction(policy.version, action) }, label);
}

async function policyAction(version, action) {
  try {
    const result = await api(`/api/policies/${encodeURIComponent(version)}/${action}`, { method: 'POST', body: {} });
    if (action === 'validate' && result?.valid === false) {
      toast(`${version} failed validation: ${result.errors?.join(' ') || 'See policy rules.'}`, 'error');
      addActivity('Policy validation failed', `${version} · ${result.errors?.join(' ') || ''}`, 'error');
    } else {
      const label = { validate: 'validated', approve: 'approved', activate: 'activated', rollback: 'rolled back' }[action];
      toast(`Policy ${version} ${label}.`);
      addActivity(`Policy ${label}`, version, action === 'activate' ? 'routed' : action === 'rollback' ? 'error' : '');
    }
    await refreshServerData();
  } catch (error) {
    handleApiError(error, `Policy ${action}`);
  }
}

function renderPolicy() {
  $('#policy-version').textContent = state.policy.version;
  $('#policy-heading').textContent = `${state.policy.version} · active`;
  mount($('#policy-ruler'), policyRuler(state.policy));
  const versions = [...state.policies].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  $('#policy-versions').replaceChildren(...(versions.length ? versions.map((policy) => h('li', {},
    h('div', {}, h('strong', { text: policy.version }), h('small', { text: hasThresholds(policy) ? `Mail ≤ ${formatKg(policy.mailWeightLimit)} · Regular ≤ ${formatKg(policy.regularWeightLimit)} · Insurance > ${formatEur(policy.insuranceValueThreshold)}` : 'Custom rule set' })),
    h('div', { class: 'version-status' }, h('span', { class: `state ${policy.state}`, text: policy.state }), policyActionButton(policy))))
    : [h('li', { class: 'muted' }, 'Version history appears once the server is reachable.')]));
}

function renderActivity() {
  $('#timeline').replaceChildren(...(state.activity.length
    ? state.activity.map((item) => h('li', {}, h('time', { text: item.time }), h('i', { class: item.kind }), h('div', {}, h('strong', { text: item.label }), h('small', { text: item.detail }))))
    : [h('li', {}, h('span', { class: 'empty', text: 'Nothing has happened yet in this session.' }))]));
}

/* ---------- decision replay ---------- */

function renderReplay() {
  const batchId = state.batch?.batchId;
  $('#replay-batch-label').textContent = batchId
    ? `Batch ${batchId.slice(0, 8)} · originally routed under ${state.batch.policyVersion}`
    : 'Process a batch or a single parcel first, then replay it here.';
  const versions = [...state.policies].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  $('#replay-policy').replaceChildren(...versions.map((policy) => h('option', { value: policy.version, text: `${policy.version} · ${policy.state}` })));
  $('#replay-run').disabled = !batchId || !versions.length;
}

async function runReplay() {
  const batchId = state.batch?.batchId;
  const policyVersion = $('#replay-policy').value;
  if (!batchId || !policyVersion) return;
  try {
    const result = await api('/api/replay', { method: 'POST', body: { batchId, policyVersion } });
    $('#replay-results-card').hidden = false;
    $('#replay-original-version').textContent = result.originalPolicy;
    $('#replay-target-version').textContent = result.replayPolicy;
    $('#replay-summary').textContent = result.changed
      ? `${fmt(result.changed)} of ${fmt(result.total)} parcel${result.changed === 1 ? '' : 's'} would be routed differently under ${result.replayPolicy}`
      : `All ${fmt(result.total)} parcels would be routed the same way under ${result.replayPolicy}`;
    $('#replay-changes').replaceChildren(...(result.changes.length ? result.changes.map((change) => h('tr', {},
      h('td', {}, h('strong', { text: change.parcelId })),
      h('td', {}, h('span', { class: 'decision-tag' }, h('i', { style: { background: colorFor(change.oldDecision) } }), change.oldDecision)),
      h('td', {}, h('span', { class: 'decision-tag' }, h('i', { style: { background: colorFor(change.newDecision) } }), change.newDecision))))
      : [h('tr', {}, h('td', { colspan: '3', class: 'muted', text: 'No decisions changed.' }))]));
    addActivity('Decision replay', `Batch ${batchId.slice(0, 8)} under ${result.replayPolicy}: ${result.changed} of ${result.total} changed`, result.changed ? 'pending' : 'routed');
  } catch (error) {
    handleApiError(error, 'Replay');
  }
}

$('#replay-run').addEventListener('click', runReplay);

/* ---------- audit log ---------- */

function renderAudit() {
  const denied = state.auditAccess === 'denied';
  $('#audit-locked').hidden = !denied;
  $('#audit-card').hidden = denied;
  if (denied) return;
  const events = [...state.audit].reverse();
  $('#audit-body').replaceChildren(...(events.length ? events.map((event) => h('tr', {},
    h('td', { text: event.timestamp ? new Date(event.timestamp).toLocaleString() : '—' }),
    h('td', { text: event.actor || '—' }),
    h('td', { text: event.action }),
    h('td', { text: event.entityId || '—' }),
    h('td', { class: 'hide-sm mono', text: event.correlationId || '—' })))
    : [h('tr', {}, h('td', { colspan: '5', class: 'muted', text: 'No audited actions yet.' }))]));
}

/* ---------- single parcel ---------- */

const form = $('#parcel-form');

function formParcel() {
  const data = new FormData(form);
  return {
    id: String(data.get('id') || '').trim() || `manual-${Date.now().toString(36)}`,
    weight: data.get('weight'),
    value: data.get('value'),
    destinationCountry: String(data.get('destinationCountry') || '').trim()
  };
}

function renderPrediction() {
  const parcel = formParcel();
  const [{ outcome }] = routeBatch([{ ...parcel, weight: parcel.weight === '' ? NaN : parcel.weight, value: parcel.value === '' ? NaN : parcel.value }], state.policy);
  const decision = decisionOf(outcome);
  form.elements.weight.setAttribute('aria-invalid', String(/Weight/.test(outcome.reason) && outcome.status === 'error'));
  form.elements.value.setAttribute('aria-invalid', String(/Value/.test(outcome.reason) && outcome.status === 'error'));
  form.elements.destinationCountry.setAttribute('aria-invalid', String(/country/i.test(outcome.reason) && outcome.status === 'error'));
  $('#prediction').replaceChildren(h('i', { style: { background: colorFor(decision) } }), h('div', {}, h('strong', { text: outcome.status === 'error' ? 'Cannot route yet' : `Likely: ${decision}` }), h('small', { text: `${outcome.reason} (preview under ${state.policy.version})` })));
}

form.addEventListener('input', renderPrediction);
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const parcel = formParcel();
  if (await submitParcels([parcel], `manual-${parcel.id}-${Date.now()}`, `Parcel ${parcel.id}`)) {
    const result = state.results[0];
    if (result) inspect(result);
  }
});

/* ---------- batch upload ---------- */

function setProgress(percent) {
  $('#file-progress').style.width = `${percent}%`;
}

async function processFile(file) {
  $('#file-status').hidden = false;
  $('#file-name').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
  setProgress(15);
  try {
    const parcels = await parseUpload(file);
    setProgress(55);
    await submitParcels(parcels, `upload-${file.name}-${file.lastModified}-${file.size}`, file.name);
    setProgress(100);
    location.hash = '#outcomes';
  } catch (error) {
    setProgress(0);
    setNotice(`${file.name} could not be read: ${error.message}`, 'error');
    toast(`${file.name}: ${error.message}`, 'error');
  }
}

async function loadSample() {
  const seed = Math.floor(Math.random() * 1e6);
  $('#file-status').hidden = false;
  $('#file-name').textContent = 'Generated sample · 120 parcels';
  setProgress(50);
  await submitParcels(generateSampleBatch({ size: 120, seed }), `sample-${seed}`, 'Sample batch');
  setProgress(100);
  location.hash = '#outcomes';
}

const dropZone = $('#drop-zone');
$('#file-input').addEventListener('change', (event) => {
  const [file] = event.target.files;
  if (file) processFile(file);
  event.target.value = '';
});
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
dropZone.addEventListener('drop', (event) => {
  const [file] = event.dataTransfer.files;
  if (file) processFile(file);
});
for (const id of ['#sample-button', '#hero-sample', '#empty-sample']) $(id).addEventListener('click', loadSample);

/* ---------- outcomes toolbar ---------- */

$('#search-input').addEventListener('input', (event) => {
  state.search = event.target.value;
  state.page = 0;
  renderTable();
});

$('#export-button').addEventListener('click', () => {
  const escapeCsv = (value) => {
    const text = String(value ?? '');
    // Prefix formula-like cells so spreadsheets do not execute them.
    return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const rows = state.results.map(({ id, parcel, outcome }) => [id, parcel?.weight, parcel?.value, parcel?.destinationCountry, statusOf(outcome), decisionOf(outcome), outcome.matchedRule, outcome.reason, outcome.policyVersion]);
  const csv = [['Parcel ID', 'Weight (kg)', 'Value (EUR)', 'Destination', 'Status', 'Decision', 'Rule', 'Reason', 'Policy version'], ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const link = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: `routing-decisions-${new Date().toISOString().slice(0, 10)}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$('#clear-button').addEventListener('click', () => {
  state.results = [];
  state.batch = null;
  closeInspector();
  setNotice('');
  renderOutcomes();
  scheduleSimulation();
});

document.querySelectorAll('.kpi').forEach((card) => card.addEventListener('click', () => {
  if (!state.results.length) return loadSample();
  state.filter = card.dataset.filter;
  state.page = 0;
  renderOutcomes();
  location.hash = '#outcomes';
}));

/* ---------- inspector, simulator controls ---------- */

$('#inspector-close').addEventListener('click', closeInspector);
for (const slider of Object.values(sliders)) slider.input.addEventListener('input', scheduleSimulation);
$('#sim-reset').addEventListener('click', resetSimulator);
$('#sim-draft').addEventListener('click', saveDraftPolicy);

/* ---------- identity ---------- */

const identityDialog = $('#identity-dialog');
const identityForm = $('#identity-form');

function renderIdentity() {
  const identity = loadIdentity();
  const name = identity?.token ? 'Token session' : identity?.actor || 'Not signed in';
  $('#identity-name').textContent = name;
  $('#identity-role').textContent = identity?.token ? 'Role from access token' : identity?.role ? `${identity.role[0]}${identity.role.slice(1).toLowerCase()} · demo` : 'Choose an identity';
  $('#identity-avatar').textContent = name === 'Not signed in' ? '?' : name.slice(0, 2).toUpperCase();
}

function syncIdentityMethod() {
  const method = identityForm.elements.method.value;
  identityForm.querySelectorAll('[data-method]').forEach((node) => { node.hidden = node.dataset.method !== method; });
}

function openIdentityDialog(message = '') {
  const identity = loadIdentity();
  identityForm.elements.method.value = identity?.role && !identity?.token ? 'demo' : 'token';
  identityForm.elements.token.value = '';
  if (identity?.actor) identityForm.elements.actor.value = identity.actor;
  if (identity?.role) identityForm.elements.role.value = identity.role;
  $('#identity-error').hidden = !message;
  $('#identity-error').textContent = message;
  syncIdentityMethod();
  if (!identityDialog.open) identityDialog.showModal();
}

identityForm.addEventListener('change', syncIdentityMethod);
identityForm.addEventListener('submit', (event) => {
  if (event.submitter?.value === 'save' && identityForm.elements.method.value === 'token' && !identityForm.elements.token.value.trim()) {
    event.preventDefault();
    $('#identity-error').hidden = false;
    $('#identity-error').textContent = 'Enter your access token, or choose a demo role.';
  }
});
identityDialog.addEventListener('close', () => {
  const action = identityDialog.returnValue;
  if (action === 'save') {
    const method = identityForm.elements.method.value;
    saveIdentity(method === 'token'
      ? { token: identityForm.elements.token.value.trim() }
      : { actor: identityForm.elements.actor.value.trim() || 'demo-operator', role: identityForm.elements.role.value });
  } else if (action === 'signout') {
    saveIdentity(null);
  } else {
    return;
  }
  identityPrompted = false;
  renderIdentity();
  addActivity(action === 'save' ? 'Identity changed' : 'Signed out', $('#identity-name').textContent);
  refreshServerData();
});
$('#identity-button').addEventListener('click', () => openIdentityDialog());
$('#connection-pill').addEventListener('click', () => { if (state.connection === 'auth') openIdentityDialog(); });

/* ---------- navigation & theme ---------- */

const sidebar = $('#sidebar');
function setMenu(open) {
  sidebar.classList.toggle('open', open);
  $('#scrim').hidden = !open;
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
}
$('#menu-toggle').addEventListener('click', () => setMenu(!sidebar.classList.contains('open')));
$('#scrim').addEventListener('click', () => setMenu(false));
document.querySelectorAll('.side-nav a').forEach((link) => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!$('#inspector').hidden) closeInspector();
  setMenu(false);
});

const navLinks = [...document.querySelectorAll('.side-nav a')];
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
  if (!visible) return;
  navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${visible.target.id}`));
  const link = navLinks.find((item) => item.getAttribute('href') === `#${visible.target.id}`);
  $('#topbar-section').textContent = link ? [...link.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('').trim() : 'Overview';
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('.section').forEach((section) => sectionObserver.observe(section));

const THEME_KEY = 'parcelflow.theme';
function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch { /* storage unavailable */ }
$('#theme-button').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* storage unavailable */ }
});
$('#refresh-button').addEventListener('click', () => { refreshServerData(); refreshHealth(); });

/* ---------- start ---------- */

renderIdentity();
renderOverview();
renderOutcomes();
renderActivity();
renderApprovals();
renderPolicy();
renderReplay();
renderAudit();
renderPrediction();
resetSimulator();
refreshServerData();
refreshHealth();
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  refreshServerData();
  refreshHealth();
}, 30000);
