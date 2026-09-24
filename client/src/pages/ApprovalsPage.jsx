import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import Badge from '../components/Badge.jsx';

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const handleError = useApiError();
  const toast = useToast();

  const load = useCallback(async () => {
    try { setApprovals(await api('/approvals')); } catch (error) { handleError(error, 'Loading approvals'); }
  }, [handleError]);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  async function decide(id, action) {
    setBusyId(id);
    try {
      await api(`/approvals/${id}/${action}`, { method: 'POST' });
      toast(action === 'approve' ? 'Parcel approved and routed.' : 'Parcel rejected.');
      await load();
    } catch (error) {
      handleError(error, action === 'approve' ? 'Approval' : 'Rejection');
    } finally {
      setBusyId(null);
    }
  }

  const pending = approvals.filter((a) => a.state === 'PENDING_APPROVAL');
  const decided = approvals.filter((a) => a.state !== 'PENDING_APPROVAL').slice(-10).reverse();

  return (
    <div>
      <div className="section-head">
        <div><h1>Insurance approvals</h1><p>High-value parcels wait here until a reviewer decides.</p></div>
        <Badge tone={pending.length ? 'MEDIUM' : 'LOW'}>{pending.length} pending</Badge>
      </div>

      {pending.length === 0 && decided.length === 0 && <div className="empty-state">No parcels are waiting for insurance approval.</div>}

      <div className="grid cols-2">
        {[...pending, ...decided].map((approval) => (
          <article className="card" key={approval.approvalId}>
            <div className="card-head">
              <div><span className="eyebrow">{approval.parcelId}</span><h3>&euro;{approval.parcel?.value}</h3></div>
              <Badge tone={approval.state === 'PENDING_APPROVAL' ? 'MEDIUM' : approval.state === 'APPROVED' ? 'LOW' : 'HIGH'}>{approval.state.replace('_', ' ')}</Badge>
            </div>
            <p className="muted">{approval.parcel?.weight}kg &middot; {approval.parcel?.destinationCountry} &middot; policy {approval.policyVersion}</p>
            {approval.state === 'PENDING_APPROVAL' ? (
              <div className="button-row">
                <button className="button danger" type="button" disabled={busyId === approval.approvalId} onClick={() => decide(approval.approvalId, 'reject')}>Reject</button>
                <button className="button primary" type="button" disabled={busyId === approval.approvalId} onClick={() => decide(approval.approvalId, 'approve')}>Approve</button>
              </div>
            ) : (
              <p className="muted">Decided by {approval.decidedBy}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
