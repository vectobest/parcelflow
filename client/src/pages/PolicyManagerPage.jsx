import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';

const NEXT_ACTION = { DRAFT: ['validate', 'Validate'], VALIDATED: ['approve', 'Approve'], APPROVED: ['activate', 'Activate'], ACTIVE: ['rollback', 'Roll back'] };
const STATE_TONE = { ACTIVE: 'LOW', DRAFT: 'MEDIUM', VALIDATED: 'MEDIUM', APPROVED: 'MEDIUM', ROLLED_BACK: 'HIGH' };

export default function PolicyManagerPage() {
  const { identity } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [active, setActive] = useState(null);
  const [details, setDetails] = useState({});
  const [draft, setDraft] = useState({ version: '', mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 1000, mailName: 'Mail Department', regularName: 'Regular Department', heavyName: 'Heavy Department' });
  const handleError = useApiError();
  const toast = useToast();
  const isAdmin = identity.role === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const data = await api('/policies');
      setActive(data.active);
      setPolicies([...data.policies].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))));
    } catch (error) { handleError(error, 'Loading policies'); }
  }, [handleError]);

  useEffect(() => { load(); }, [load]);

  async function createDraft(event) {
    event.preventDefault();
    try {
      await api('/policies', { body: {
        version: draft.version, insuranceValueThreshold: Number(draft.insuranceValueThreshold),
        mailWeightLimit: Number(draft.mailWeightLimit), regularWeightLimit: Number(draft.regularWeightLimit),
        departments: { mail: draft.mailName, regular: draft.regularName, heavy: draft.heavyName }
      } });
      toast(`Draft ${draft.version} created.`);
      setDraft({ ...draft, version: '' });
      await load();
    } catch (error) { handleError(error, 'Creating draft'); }
  }

  async function runAction(version, action) {
    try {
      const result = await api(`/policies/${version}/${action}`, { method: 'POST' });
      if (action === 'validate' && result.valid === false) toast(`${version} failed validation: ${result.errors.join(' ')}`, 'error');
      else toast(`${version} ${action === 'rollback' ? 'rolled back' : action + 'd'}.`);
      await load();
    } catch (error) { handleError(error, `Policy ${action}`); }
  }

  async function inspect(version) {
    try {
      const [conflicts, blastRadius] = await Promise.all([api(`/policies/${version}/conflicts`), api(`/policies/${version}/blast-radius`)]);
      setDetails((d) => ({ ...d, [version]: { conflicts, blastRadius } }));
    } catch (error) { handleError(error, 'Checking policy'); }
  }

  return (
    <div>
      <div className="section-head"><div><h1>Policy manager</h1><p>Active policies are immutable. Changes go draft &rarr; validated &rarr; approved &rarr; active.</p></div></div>

      {isAdmin && (
        <article className="card" style={{ marginBottom: 20 }}>
          <div className="card-head"><h3>New draft (rule builder)</h3></div>
          <form onSubmit={createDraft}>
            <div className="grid cols-3">
              <div className="field"><label>Version name</label><input type="text" value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} placeholder="v2" required /></div>
              <div className="field"><label>Mail limit (kg)</label><input type="number" step="0.1" min="0" value={draft.mailWeightLimit} onChange={(e) => setDraft({ ...draft, mailWeightLimit: e.target.value })} required /></div>
              <div className="field"><label>Regular limit (kg)</label><input type="number" step="0.1" min="0" value={draft.regularWeightLimit} onChange={(e) => setDraft({ ...draft, regularWeightLimit: e.target.value })} required /></div>
            </div>
            <div className="grid cols-3">
              <div className="field"><label>Insurance threshold (EUR)</label><input type="number" step="1" min="0" value={draft.insuranceValueThreshold} onChange={(e) => setDraft({ ...draft, insuranceValueThreshold: e.target.value })} required /></div>
              <div className="field"><label>Mail department name</label><input type="text" value={draft.mailName} onChange={(e) => setDraft({ ...draft, mailName: e.target.value })} required /></div>
              <div className="field"><label>Regular department name</label><input type="text" value={draft.regularName} onChange={(e) => setDraft({ ...draft, regularName: e.target.value })} required /></div>
            </div>
            <button className="button primary" type="submit">Save draft</button>
          </form>
        </article>
      )}

      <div className="grid cols-2">
        {policies.map((policy) => {
          const next = NEXT_ACTION[policy.state];
          const detail = details[policy.version];
          return (
            <article className="card" key={policy.version}>
              <div className="card-head">
                <div><span className="eyebrow">{policy.version === active?.version ? 'Active policy' : 'Version'}</span><h3>{policy.version}</h3></div>
                <Badge tone={STATE_TONE[policy.state]}>{policy.state}</Badge>
              </div>
              <p className="muted">Mail &le; {policy.mailWeightLimit}kg &middot; Regular &le; {policy.regularWeightLimit}kg &middot; Insurance &gt; &euro;{policy.insuranceValueThreshold}</p>
              <div className="button-row">
                <button className="button ghost small" type="button" onClick={() => inspect(policy.version)}>Check conflicts & blast radius</button>
                {isAdmin && next && <button className="button primary small" type="button" onClick={() => runAction(policy.version, next[0])}>{next[1]}</button>}
              </div>
              {detail && (
                <div style={{ marginTop: 12 }}>
                  {detail.conflicts.findings.length > 0 ? (
                    <ul className="evidence">{detail.conflicts.findings.map((f, i) => <li key={i}><Badge tone={f.severity === 'ERROR' ? 'HIGH' : 'MEDIUM'}>{f.severity}</Badge> {f.message}</li>)}</ul>
                  ) : <p className="muted">No rule conflicts detected.</p>}
                  <p className="recommendation">{detail.blastRadius.recommendation}</p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
