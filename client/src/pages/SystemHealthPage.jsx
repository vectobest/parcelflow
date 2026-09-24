import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';

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
    <div>
      <div className="section-head"><div><h1>System health & time machine</h1><p>Live health plus point-in-time state reconstructed from what the system actually recorded.</p></div></div>

      {health && (
        <article className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h3>Live health</h3></div>
          <p>Status: <strong>{health.status}</strong> &middot; up {health.uptimeSeconds}s &middot; active policy {health.activePolicy} &middot; OAuth {health.oauthEnabled ? 'enabled' : 'not configured'}</p>
        </article>
      )}

      <article className="card">
        <div className="card-head"><h3>Timeline</h3></div>
        {timeline.length === 0 && <p className="muted">No timestamped events recorded yet.</p>}
        <ul className="steps">
          {timeline.map((event, i) => (
            <li key={i}>
              <button className="button ghost small" type="button" onClick={() => inspectAt(event.at)}>{new Date(event.at).toLocaleTimeString()}</button>
              &nbsp;{event.label}
            </li>
          ))}
        </ul>
        {state && (
          <div className="recommendation" style={{ marginTop: 14 }}>
            <strong>State at {new Date(at).toLocaleString()}:</strong> policy {state.activePolicy || '—'} &middot; {state.parcelsProcessed} parcels processed &middot; {(state.failureRate * 100).toFixed(1)}% failure rate &middot; {state.approvalQueueSize} in approval queue &middot; {state.openIncidents.length} open incident(s)
          </div>
        )}
      </article>
    </div>
  );
}
