import { randomUUID } from 'node:crypto';
import { routeParcel } from '../routing.js';
import { assertPermission } from '../auth/authorization.js';

export function createApprovalService({ clock, policyStore, auditLog }) {
  const approvals = new Map();

  function createForBatch({ batchId, results, correlationId }) {
    return results.flatMap(({ id, outcome, parcel }) => {
      if (outcome.status !== 'pending') return [];
      const approval = { approvalId: randomUUID(), batchId, parcelId: id, parcel, state: 'PENDING_APPROVAL', policyVersion: outcome.policyVersion, createdAt: clock().toISOString(), correlationId };
      approvals.set(approval.approvalId, approval);
      return [approval.approvalId];
    });
  }

  function decide(approvalId, { actor = 'reviewer', role = 'REVIEWER', decision = 'APPROVED' } = {}) {
    assertPermission(role, 'approve');
    const approval = approvals.get(approvalId);
    if (!approval) throw new Error('Approval was not found.');
    if (approval.state !== 'PENDING_APPROVAL') throw new Error('Approval has already been decided.');
    approval.state = decision;
    approval.decidedAt = clock().toISOString();
    approval.decidedBy = actor;
    const policy = policyStore.get(approval.policyVersion);
    const outcome = decision === 'APPROVED'
      ? routeParcel(approval.parcel, policy, { insuranceApproved: true })
      : { ...routeParcel(approval.parcel, policy), status: 'rejected', decision: 'Rejected', department: null, matchedRule: 'INSURANCE_REJECTED', reason: 'Insurance approval was rejected.' };
    auditLog.record(`approval_${decision.toLowerCase()}`, approvalId, actor, approval.correlationId, 'PENDING_APPROVAL', decision);
    return { ...approval, outcome };
  }

  return { createForBatch, decide, list: () => [...approvals.values()] };
}