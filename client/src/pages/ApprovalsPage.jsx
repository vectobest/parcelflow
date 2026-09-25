import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useApiError } from '../hooks/useApiError.js';
import { useToast } from '../state/ToastContext.jsx';
import Badge from '../components/Badge.jsx';
import Panel from '../components/Panel.jsx';
import Button from '../components/Button.jsx';
import PageHeader from '../components/PageHeader.jsx';

// Code 39 encodes A-Z, 0-9 and - . $ / + % space; only IDs it can carry exactly get a barcode.
const CODE39 = /^[A-Z0-9\-. $/+%]+$/;

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
    <div className="flex flex-col gap-space-sm">
      <PageHeader eyebrow="Step 3" title="Insurance approvals" description="Parcels worth more than the insurance limit wait here until a reviewer approves or rejects them." actions={<Badge tone={pending.length ? 'MEDIUM' : 'LOW'}>{pending.length} pending</Badge>} />

      {pending.length === 0 && decided.length === 0 && (
        <div className="border border-dashed border-outline-variant px-space-md py-space-xl text-center font-body-compact text-body-compact text-on-surface-variant">
          Nothing is waiting for a reviewer. High-value parcels appear here as soon as they're routed.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
        {[...pending, ...decided].map((approval) => (
          <Panel
            key={approval.approvalId}
            meta={approval.parcelId}
            title={`€${approval.parcel?.value}`}
            actions={<Badge tone={approval.state === 'PENDING_APPROVAL' ? 'MEDIUM' : approval.state === 'APPROVED' ? 'LOW' : 'HIGH'}>{approval.state.replace('_', ' ')}</Badge>}
          >
            <p className="font-body-compact text-body-compact text-on-surface-variant mb-space-sm">{approval.parcel?.weight}kg to {approval.parcel?.destinationCountry}, checked under rules {approval.policyVersion}</p>
            {CODE39.test(approval.parcelId) && (
              <div className="light-only mb-space-sm" aria-hidden="true">
                <div className="barcode text-[44px] h-[40px] text-on-surface">{`*${approval.parcelId}*`}</div>
              </div>
            )}
            {approval.state === 'PENDING_APPROVAL' ? (
              <div className="flex gap-space-sm">
                <Button variant="danger" disabled={busyId === approval.approvalId} onClick={() => decide(approval.approvalId, 'reject')} className="flex-1">Reject</Button>
                <Button variant="primary" disabled={busyId === approval.approvalId} onClick={() => decide(approval.approvalId, 'approve')} className="flex-1">Approve</Button>
              </div>
            ) : (
              <p className="font-body-compact text-body-compact text-on-surface-variant">Decided by {approval.decidedByName || approval.decidedBy}</p>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}
