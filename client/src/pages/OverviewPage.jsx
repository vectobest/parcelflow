import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Icon from '../components/Icon.jsx';

const HEALTH_TONE = { HEALTHY: 'LOW', DEGRADED: 'MEDIUM', CRITICAL: 'HIGH' };

const KPI_TONES = {
  primary: { value: 'text-white', mark: 'bg-on-surface-variant/40' },
  tertiary: { value: 'text-tertiary', mark: 'bg-tertiary' },
  secondary: { value: 'text-white', mark: 'bg-caution' },
  error: { value: 'text-error', mark: 'bg-error' }
};

// Painted floor bay: big signage count, bay number, and a colour mark along the top edge.
function KpiCard({ bay, icon, tone, label, value, note }) {
  const t = KPI_TONES[tone] || KPI_TONES.primary;
  return (
    <div className={`card relative rounded-card bg-surface-container-low border border-white/[0.08] p-3.5 pt-4 flex flex-col justify-between overflow-hidden`}>
      <span className={`kpi-mark absolute inset-x-0 top-0 h-[3px] ${t.mark}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-on-surface-variant">{label}</span>
        <span className="bay-label font-mono text-[9px] tracking-[0.12em] text-on-surface-variant/60 shrink-0">BAY {bay}</span>
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div className={`font-display font-black text-[30px] leading-none tabular-nums ${t.value}`}>{value}</div>
        <Icon name={icon} className="text-[16px] text-on-surface-variant/50" />
      </div>
      {note && <div className="mt-1.5 text-[11px] text-on-surface-variant">{note}</div>}
    </div>
  );
}

// Mail, regular, heavy -- the order parcels move through by weight.
const DEPARTMENT_ORDER = ['mail', 'regular', 'heavy'];
const DEFAULT_DEPARTMENTS = ['Mail Department', 'Regular Department', 'Heavy Department'];

function SortLabel({ name, count, note, band, to }) {
  const body = (
    <>
      {band && <div className={`h-2 ${band}`} aria-hidden="true" />}
      <div className="p-3 sm:p-4 flex flex-col gap-2 h-full">
        <span className="flex flex-col" aria-label={name}>
          <span className="tile-name font-display text-[20px] sm:text-[24px] leading-none text-on-surface" aria-hidden="true">{name.split(' ')[0]}</span>
          {name.includes(' ') && <span className="tile-sub mt-1 text-[12px] leading-none text-on-surface" aria-hidden="true">{name.slice(name.indexOf(' ') + 1)}</span>}
        </span>
        <span className="mt-auto flex items-baseline gap-1.5 flex-wrap">
          <span className="font-display text-[30px] leading-none tabular-nums text-on-surface">{count}</span>
          <span className="text-[12px] text-on-surface-variant">{note}</span>
        </span>
      </div>
    </>
  );
  const className = 'card rounded-card bg-surface-container-low overflow-hidden flex flex-col';
  return to
    ? <Link to={to} className={`${className} hover:outline hover:outline-2 hover:outline-black`} aria-label={`${count} ${note}, open approvals`}>{body}</Link>
    : <div className={className}>{body}</div>;
}

// Light theme only: one label per outcome, the way a sort wall looks on the depot floor.
function SortWall({ snapshot }) {
  // Held parcels are counted under an insurance "department" too; they get their own label below instead.
  const counted = Object.keys(snapshot.departmentDistribution).filter((name) => !/insurance/i.test(name));
  const rank = (name) => { const i = DEPARTMENT_ORDER.indexOf(name.split(/\s+/)[0].toLowerCase()); return i === -1 ? DEPARTMENT_ORDER.length : i; };
  const departments = (counted.length ? counted : DEFAULT_DEPARTMENTS).sort((a, b) => rank(a) - rank(b));
  return (
    <div className="light-only sort-wall grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {departments.map((name) => (
        <SortLabel key={name} name={name} count={snapshot.departmentDistribution[name] || 0} note="routed" band="bg-black" />
      ))}
      <SortLabel name="Insurance check" count={snapshot.pendingApproval} note="waiting for a reviewer" band="bg-[rgb(var(--c-tape))]" to="/approvals" />
      <SortLabel name="Couldn't be routed" count={snapshot.validationErrors} note="need fixing" band="bg-error" />
    </div>
  );
}

export default function OverviewPage() {
  const [dashboard, setDashboard] = useState(null);
  const handleError = useApiError();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api('/dashboard');
        if (!cancelled) setDashboard(data);
      } catch (error) {
        if (!cancelled) handleError(error, 'Loading dashboard');
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [handleError]);

  if (!dashboard) return <p className="text-[13px] text-on-surface-variant">Loading dashboard...</p>;
  const { snapshot, risk, health, attentionRequired, scope } = dashboard;
  const ownView = scope === 'own';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Parcel Routing Control Room"
        title="Dispatch overview"
        description={ownView
          ? (snapshot.totalParcels ? <>You've submitted {snapshot.totalParcels} parcels. Routing rules {snapshot.activePolicy} are active.</> : <>You haven't submitted any parcels yet. Route one or upload a batch from Intake to start.</>)
          : <>{snapshot.totalParcels} parcels processed by all operators. Routing rules {snapshot.activePolicy} are active.</>}
        actions={<Badge tone={HEALTH_TONE[health] || 'MEDIUM'}>{health}</Badge>}
      />

      <SortWall snapshot={snapshot} />

      <div className="dark-only kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard hero bay="01" icon="package_2" tone="primary" label="Parcels Processed" value={snapshot.totalParcels} note={ownView ? (snapshot.totalParcels ? 'Submitted by you' : 'Route a parcel or upload a batch to start') : 'All operators'} />
        <KpiCard bay="02" icon="verified" tone="tertiary" label="Routed" value={snapshot.successful} note="Successfully dispatched" />
        <KpiCard bay="03" icon="pending_actions" tone="secondary" label="Awaiting Approval" value={snapshot.pendingApproval} note="In the approval queue" />
        <KpiCard bay="04" icon="warning" tone="error" label="Validation Errors" value={snapshot.validationErrors} note={snapshot.validationErrors > 0 ? 'Needs review' : 'None this session'} />
      </div>

      {attentionRequired.length > 0 && (
        <section className="attn card rounded-card border border-error/40 bg-error-container/40 overflow-hidden" aria-labelledby="attention-heading">
          <div className="h-2 hazard-stripe-error" aria-hidden="true" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Icon name="warning" className="text-[16px] text-error" />
              <h2 id="attention-heading" className="font-display font-black uppercase text-[16px] tracking-[0.02em] text-white">Needs attention now</h2>
              <Badge tone="error">{attentionRequired.length} item{attentionRequired.length === 1 ? '' : 's'}</Badge>
            </div>
            <ol className="flex flex-col divide-y divide-error/20">
              {attentionRequired.map((item, i) => (
                <li key={i} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="attn-num font-stencil font-extrabold text-[16px] leading-none text-error w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[13px] text-on-surface leading-snug">{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <Panel
        icon="monitoring"
        title="Trends to watch"
        actions={<Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')}</Badge>}
      >
        <p className="font-semibold text-[14px] text-white mb-1">{risk.title}</p>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{risk.message}</p>
        {risk.evidence.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {risk.evidence.map((e, i) => (
              <li key={i} className="text-[12px] text-on-surface-variant flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-primary/70 mt-1.5 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-l-[3px] border-primary bg-surface-container-lowest px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <span className="font-mono text-[9px] text-primary uppercase tracking-[0.12em] shrink-0">Next step</span>
          <span className="text-[12px] text-on-surface sm:text-right">{risk.recommendation}</span>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Link to="/intake"><Button variant="primary"><Icon name="upload" className="text-[16px]" />Route parcels</Button></Link>
        <Link to="/incidents"><Button variant="ghost"><Icon name="emergency_home" className="text-[16px]" />Open incidents</Button></Link>
        <Link to="/assistant"><Button variant="outline"><Icon name="terminal" className="text-[16px]" />Ask the assistant</Button></Link>
      </div>
    </div>
  );
}
