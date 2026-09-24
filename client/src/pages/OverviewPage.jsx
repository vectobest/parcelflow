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

const KPI_STYLES = {
  primary: { icon: 'bg-primary/15 border-primary/30 text-primary', border: 'hover:border-primary/30', value: 'text-white' },
  tertiary: { icon: 'bg-tertiary/15 border-tertiary/30 text-tertiary', border: 'hover:border-tertiary/30', value: 'text-tertiary' },
  secondary: { icon: 'bg-secondary/15 border-secondary/30 text-secondary', border: 'hover:border-secondary/30', value: 'text-white' },
  error: { icon: 'bg-error/20 border-error/40 text-error', border: 'border-error/25 hover:border-error/40', value: 'text-error' }
};

function KpiCard({ icon, tone, label, value, note }) {
  const s = KPI_STYLES[tone] || KPI_STYLES.primary;
  return (
    <div className={`p-5 rounded-2xl bg-surface-container-low border border-white/[0.08] ${s.border} transition-colors flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-on-surface-variant tracking-wide uppercase">{label}</span>
        <span className={`w-9 h-9 rounded-xl border flex items-center justify-center ${s.icon}`}>
          <Icon name={icon} className="text-[19px]" />
        </span>
      </div>
      <div className="mt-4">
        <div className={`font-mono text-[28px] font-bold tracking-tight ${s.value}`}>{value}</div>
        {note && <div className="flex items-center gap-1.5 mt-1.5"><span className="text-[11px] text-on-surface-variant font-medium">{note}</span></div>}
      </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon="package_2" tone="primary" label="Parcels Processed" value={snapshot.totalParcels} note="This session" />
        <KpiCard icon="verified" tone="tertiary" label="Routed" value={snapshot.successful} note="Successfully dispatched" />
        <KpiCard icon="pending_actions" tone="secondary" label="Awaiting Approval" value={snapshot.pendingApproval} note="In the approval queue" />
        <KpiCard icon="warning" tone="error" label="Validation Errors" value={snapshot.validationErrors} note={snapshot.validationErrors > 0 ? 'Needs review' : 'None this session'} />
      </div>

      {attentionRequired.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-error/15 border border-error/30 text-error flex items-center justify-center">
              <Icon name="error" className="text-[18px]" />
            </span>
            <h2 className="text-[17px] font-bold text-white tracking-tight">Needs Immediate Attention</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-error/20 border border-error/30 text-error text-[11px] font-bold tracking-wide">{attentionRequired.length} item{attentionRequired.length === 1 ? '' : 's'}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attentionRequired.map((item, i) => (
              <div key={i} className="p-5 rounded-2xl bg-surface-container-low border border-error/25 flex items-start gap-3">
                <span className="w-8 h-8 rounded-xl bg-error/15 border border-error/30 text-error flex items-center justify-center shrink-0">
                  <Icon name="priority_high" className="text-[16px]" />
                </span>
                <p className="text-[13px] text-on-surface font-medium leading-snug pt-1">{item}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Panel
        icon="monitoring"
        title="Operational Intelligence"
        actions={<Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')}</Badge>}
      >
        <p className="font-semibold text-[16px] text-white mb-1.5">{risk.title}</p>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{risk.message}</p>
        {risk.evidence.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {risk.evidence.map((e, i) => (
              <li key={i} className="text-[13px] text-on-surface-variant flex items-start gap-2">
                <span className="w-1 h-1 rounded-full bg-on-surface-variant mt-2 shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 p-3.5 rounded-xl bg-surface-container/70 border border-white/[0.08] flex items-center justify-between gap-3 shadow-inner">
          <span className="text-[12px] text-on-surface font-bold uppercase tracking-wide shrink-0">Next Step</span>
          <span className="text-[13px] text-primary text-right font-medium">{risk.recommendation}</span>
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
