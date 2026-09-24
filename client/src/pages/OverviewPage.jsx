import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

const HEALTH_TONE = { HEALTHY: 'LOW', DEGRADED: 'MEDIUM', CRITICAL: 'HIGH' };

function Stat({ label, value, tone, suffix }) {
  const toneClass = { routed: 'text-tertiary', pending: 'text-secondary', error: 'text-error' }[tone] || 'text-on-surface';
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-space-3xs text-on-surface-variant font-kpi-micro text-kpi-micro uppercase">
        <span className={`w-1.5 h-1.5 inline-block ${tone ? toneClass.replace('text-', 'bg-') : 'bg-primary'}`} />
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-space-xs">
        <span className={`font-display-xl-mobile sm:font-data-lg text-display-xl-mobile sm:text-data-lg font-bold ${toneClass}`}>{value}</span>
        {suffix && <span className="font-code-sm text-code-sm text-on-surface-variant">{suffix}</span>}
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

  if (!dashboard) return <p className="font-code-sm text-code-sm text-on-surface-variant">Loading dashboard...</p>;
  const { snapshot, risk, health, attentionRequired } = dashboard;

  return (
    <div className="flex flex-col gap-space-sm">
      <section className="bg-surface-container-low px-space-md py-space-sm">
        <div className="flex flex-wrap items-end justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-xl">
            <Stat label="Parcels Processed" value={snapshot.totalParcels} tone="" suffix="THIS SESSION" />
            <div className="h-8 w-px bg-outline-variant hidden sm:block" />
            <Stat label="Routed" value={snapshot.successful} tone="routed" />
            <div className="h-8 w-px bg-outline-variant hidden sm:block" />
            <Stat label="Awaiting Approval" value={snapshot.pendingApproval} tone="pending" />
            <div className="h-8 w-px bg-outline-variant hidden md:block" />
            <Stat label="Validation Errors" value={snapshot.validationErrors} tone="error" />
          </div>
          <Badge tone={HEALTH_TONE[health] || 'MEDIUM'}>{health}</Badge>
        </div>
        <p className="mt-space-xs font-body-compact text-body-compact text-on-surface-variant">
          Policy <span className="text-on-surface font-semibold">{snapshot.activePolicy}</span> active this session.
        </p>
      </section>

      {attentionRequired.length > 0 && (
        <Panel icon="warning" title="Needs Attention">
          <ul className="flex flex-col gap-space-xs">
            {attentionRequired.map((item, i) => (
              <li key={i} className="flex items-start gap-space-xs font-body-compact text-body-compact text-on-surface">
                <span className="w-1.5 h-1.5 mt-1.5 bg-secondary inline-block shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        icon="monitoring"
        title="Operational Intelligence"
        actions={<Badge tone={risk.level}>{risk.level.replaceAll('_', ' ')}</Badge>}
      >
        <p className="font-headline-md text-headline-md text-on-surface font-semibold mb-space-2xs">{risk.title}</p>
        <p className="font-body-compact text-body-compact text-on-surface-variant">{risk.message}</p>
        {risk.evidence.length > 0 && (
          <ul className="mt-space-xs flex flex-col gap-space-3xs">
            {risk.evidence.map((e, i) => (
              <li key={i} className="font-body-compact text-body-compact text-on-surface-variant">&middot; {e}</li>
            ))}
          </ul>
        )}
        <div className="mt-space-sm bg-surface-container px-space-sm py-space-2xs flex items-center justify-between">
          <span className="font-code-sm text-code-sm text-on-surface font-bold uppercase">Next Step</span>
          <span className="font-code-sm text-code-sm text-primary text-right">{risk.recommendation}</span>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-space-sm">
        <Link to="/intake"><Button variant="primary"><Icon name="upload" className="text-[16px]" />Route a Parcel or Batch</Button></Link>
        <Link to="/incidents"><Button variant="ghost"><Icon name="emergency_home" className="text-[16px]" />View Incident Center</Button></Link>
        <Link to="/assistant"><Button variant="outline"><Icon name="terminal" className="text-[16px]" />Ask the Ops Assistant</Button></Link>
      </div>
    </div>
  );
}
