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
  secondary: { value: 'text-white', mark: 'bg-primary' },
  error: { value: 'text-error', mark: 'bg-error' }
};

// Painted floor bay: big signage count, bay number, and a colour mark along the top edge.
function KpiCard({ bay, icon, tone, label, value, note }) {
  const t = KPI_TONES[tone] || KPI_TONES.primary;
  return (
    <div className="relative rounded-sm bg-surface-container-low border border-white/[0.08] p-5 pt-6 flex flex-col justify-between overflow-hidden">
      <span className={`absolute inset-x-0 top-0 h-[3px] ${t.mark}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-on-surface-variant">{label}</span>
        <span className="font-mono text-[10px] tracking-[0.14em] text-on-surface-variant/60 shrink-0">BAY {bay}</span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className={`font-display font-black text-[64px] leading-[0.85] tabular-nums ${t.value}`}>{value}</div>
        <Icon name={icon} className="text-[22px] text-on-surface-variant/50 mb-1" />
      </div>
      {note && <div className="mt-3 text-[13px] text-on-surface-variant">{note}</div>}
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
  const { snapshot, risk, health, attentionRequired } = dashboard;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Parcel Routing Control Room"
        title="Dispatch Overview"
        description={<>Policy <span className="text-on-surface font-semibold">{snapshot.activePolicy}</span> active this session &mdash; live routing, approvals and risk in one view.</>}
        actions={<Badge tone={HEALTH_TONE[health] || 'MEDIUM'}>{health}</Badge>}
      />

      <div className="kpi-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard bay="01" icon="package_2" tone="primary" label="Parcels Processed" value={snapshot.totalParcels} note="This session" />
        <KpiCard bay="02" icon="verified" tone="tertiary" label="Routed" value={snapshot.successful} note="Successfully dispatched" />
        <KpiCard bay="03" icon="pending_actions" tone="secondary" label="Awaiting Approval" value={snapshot.pendingApproval} note="In the approval queue" />
        <KpiCard bay="04" icon="warning" tone="error" label="Validation Errors" value={snapshot.validationErrors} note={snapshot.validationErrors > 0 ? 'Needs review' : 'None this session'} />
      </div>

      {attentionRequired.length > 0 && (
        <section className="rounded-sm border border-error/40 bg-error-container/40 overflow-hidden" aria-labelledby="attention-heading">
          <div className="h-2 hazard-stripe-error" aria-hidden="true" />
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Icon name="warning" className="text-[22px] text-error" />
              <h2 id="attention-heading" className="font-display font-black uppercase text-[24px] tracking-[0.03em] text-white">Needs Immediate Attention</h2>
              <Badge tone="error">{attentionRequired.length} item{attentionRequired.length === 1 ? '' : 's'}</Badge>
            </div>
            <ol className="flex flex-col divide-y divide-error/20">
              {attentionRequired.map((item, i) => (
                <li key={i} className="flex items-start gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="font-stencil font-extrabold text-[22px] leading-none text-error w-7 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-[14px] text-on-surface leading-snug">{item}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <Panel
        icon="monitoring"
        title="Operational Intelligence"
        actions={<Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')}</Badge>}
      >
        <p className="font-semibold text-[18px] text-white mb-1.5">{risk.title}</p>
        <p className="text-[14px] text-on-surface-variant leading-relaxed">{risk.message}</p>
        {risk.evidence.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {risk.evidence.map((e, i) => (
              <li key={i} className="text-[14px] text-on-surface-variant flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-primary/70 mt-2 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-l-[3px] border-primary bg-surface-container-lowest px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-primary uppercase tracking-[0.14em] shrink-0">Next step</span>
          <span className="text-[14px] text-on-surface sm:text-right">{risk.recommendation}</span>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Link to="/intake"><Button variant="primary"><Icon name="upload" className="text-[16px]" />Route a Parcel or Batch</Button></Link>
        <Link to="/incidents"><Button variant="ghost"><Icon name="emergency_home" className="text-[16px]" />View Incident Center</Button></Link>
        <Link to="/assistant"><Button variant="outline"><Icon name="terminal" className="text-[16px]" />Ask the Ops Assistant</Button></Link>
      </div>
    </div>
  );
}
