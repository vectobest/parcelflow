import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import Badge from '../components/Badge.jsx';
import PageHeader from '../components/PageHeader.jsx';

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [at, setAt] = useState('');
  const [state, setState] = useState(null);
  const handleError = useApiError();

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then(setHealth).catch(() => {});
    api('/history/timeline').then(setTimeline).catch((error) => handleError(error, 'Loading timeline'));
  }, [handleError]);

  async function inspectAt(timestamp) {
    setAt(timestamp);
    try { setState(await api(`/history/state?at=${encodeURIComponent(timestamp)}`)); } catch (error) { handleError(error, 'Loading historical state'); }
  }

  return (
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Governance" title="System Health &amp; Time Machine" description="Live health plus point-in-time state reconstructed from what the system actually recorded." />

      {health && (
        <Panel icon="monitor_heart" title="Live Health" actions={<Badge tone="LOW">{health.status}</Badge>}>
          <p className="font-body-compact text-body-compact text-on-surface-variant">
            Up <span className="text-on-surface font-semibold">{health.uptimeSeconds}s</span>, active policy <span className="text-on-surface font-semibold">{health.activePolicy}</span>, OAuth <span className="text-on-surface font-semibold">{health.oauthEnabled ? 'enabled' : 'not configured'}</span>
          </p>
        </Panel>
      )}

      <Panel icon="schedule" title="Timeline">
        {timeline.length === 0 && <p className="font-body-compact text-body-compact text-on-surface-variant">No timestamped events recorded yet.</p>}
        <ul className="flex flex-col gap-space-xs">
          {timeline.map((event, i) => (
            <li key={i} className="flex items-center gap-space-sm border-b border-outline-variant pb-space-xs last:border-b-0">
              <Button variant="outline" size="sm" onClick={() => inspectAt(event.at)}>{new Date(event.at).toLocaleTimeString()}</Button>
              <span className="font-body-compact text-body-compact text-on-surface">{event.label}</span>
            </li>
          ))}
        </ul>
        {state && (
          <div className="mt-space-sm bg-surface-container px-space-sm py-space-xs font-body-compact text-body-compact text-on-surface">
            <strong className="text-primary">State at {new Date(at).toLocaleString()}:</strong> policy {state.activePolicy || '—'}, {state.parcelsProcessed} parcels processed, {(state.failureRate * 100).toFixed(1)}% failure rate, {state.approvalQueueSize} in approval queue, {state.openIncidents.length} open incident(s)
          </div>
        )}
      </Panel>
    </div>
  );
}
