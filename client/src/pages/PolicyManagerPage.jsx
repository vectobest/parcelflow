import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { Field, Input } from '../components/Field.jsx';

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Governance" title="Policy Manager" description="Active policies are immutable. Changes go draft → validated → approved → active." />

      {isAdmin && (
        <Panel icon="gavel" title="New Draft (Rule Builder)">
          <form onSubmit={createDraft} className="flex flex-col gap-space-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
              <Field label="Version name"><Input type="text" value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} placeholder="v2" required /></Field>
              <Field label="Mail limit (kg)"><Input type="number" step="0.1" min="0" value={draft.mailWeightLimit} onChange={(e) => setDraft({ ...draft, mailWeightLimit: e.target.value })} required /></Field>
              <Field label="Regular limit (kg)"><Input type="number" step="0.1" min="0" value={draft.regularWeightLimit} onChange={(e) => setDraft({ ...draft, regularWeightLimit: e.target.value })} required /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
              <Field label="Insurance threshold (EUR)"><Input type="number" step="1" min="0" value={draft.insuranceValueThreshold} onChange={(e) => setDraft({ ...draft, insuranceValueThreshold: e.target.value })} required /></Field>
              <Field label="Mail department name"><Input type="text" value={draft.mailName} onChange={(e) => setDraft({ ...draft, mailName: e.target.value })} required /></Field>
              <Field label="Regular department name"><Input type="text" value={draft.regularName} onChange={(e) => setDraft({ ...draft, regularName: e.target.value })} required /></Field>
            </div>
            <Button variant="primary" type="submit" className="self-start">Save Draft</Button>
          </form>
        </Panel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        {policies.map((policy) => {
          const next = NEXT_ACTION[policy.state];
          const detail = details[policy.version];
          return (
            <Panel
              key={policy.version}
              meta={policy.version === active?.version ? 'Active Policy' : 'Version'}
              title={policy.version}
              actions={<Badge tone={STATE_TONE[policy.state]}>{policy.state}</Badge>}
            >
              <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">Mail &le; {policy.mailWeightLimit}kg &middot; Regular &le; {policy.regularWeightLimit}kg &middot; Insurance &gt; &euro;{policy.insuranceValueThreshold}</p>
              <div className="flex flex-wrap gap-space-sm">
                <Button variant="outline" size="sm" onClick={() => inspect(policy.version)}>Check Conflicts &amp; Blast Radius</Button>
                {isAdmin && next && <Button variant="primary" size="sm" onClick={() => runAction(policy.version, next[0])}>{next[1]}</Button>}
              </div>
              {detail && (
                <div className="mt-space-sm pt-space-sm border-t border-outline-variant">
                  {detail.conflicts.findings.length > 0 ? (
                    <ul className="flex flex-col gap-space-2xs mb-space-sm">
                      {detail.conflicts.findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-space-xs font-body-compact text-body-compact text-on-surface">
                          <Badge tone={f.severity === 'ERROR' ? 'HIGH' : 'MEDIUM'}>{f.severity}</Badge> {f.message}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">No rule conflicts detected.</p>}
                  <div className="bg-surface-container px-space-sm py-space-2xs font-code-sm text-code-sm text-primary">{detail.blastRadius.recommendation}</div>
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
