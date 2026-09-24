import { randomUUID } from 'node:crypto';
import { RoutingDecision } from '../domain/RoutingDecision.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

/**
 * Manages the insurance-approval workflow that high-value parcels are held
 * in. Depends only on abstractions injected by the composition root
 * (RoutingEngine, PolicyService, AuditService, AuthorizationService, an
 * ApprovalRepository) -- this class never knows how any of them are
 * implemented (DIP).
 */
export class ApprovalService {
  #repository;
  #routingEngine;
  #policyService;
  #auditService;
  #authorizationService;
  #clock;

  constructor({ repository, routingEngine, policyService, auditService, authorizationService, clock = () => new Date() }) {
    this.#repository = repository;
    this.#routingEngine = routingEngine;
    this.#policyService = policyService;
    this.#auditService = auditService;
    this.#authorizationService = authorizationService;
    this.#clock = clock;
  }

  createForBatch({ batchId, results, correlationId }) {
    return results.flatMap(({ id, outcome, parcel }) => {
      if (outcome.status !== 'pending') return [];
      const approval = {
        approvalId: randomUUID(),
        batchId,
        parcelId: id,
        parcel,
        state: 'PENDING_APPROVAL',
        policyVersion: outcome.policyVersion,
        createdAt: this.#clock().toISOString(),
        correlationId
      };
      this.#repository.save(approval);
      return [approval.approvalId];
    });
  }

  decide(approvalId, { actor = 'reviewer', role = 'REVIEWER', decision = 'APPROVED' } = {}) {
    this.#authorizationService.assertPermission(role, 'approve');
    const approval = this.#repository.get(approvalId);
    if (!approval) throw new NotFoundError('Approval was not found.');
    if (approval.state !== 'PENDING_APPROVAL') throw new ConflictError('Approval has already been decided.');

    const updated = { ...approval, state: decision, decidedAt: this.#clock().toISOString(), decidedBy: actor };
    this.#repository.save(updated);

    const policy = this.#policyService.get(updated.policyVersion);
    const outcome = decision === 'APPROVED'
      ? this.#routingEngine.route(updated.parcel, policy, { insuranceApproved: true })
      : RoutingDecision.rejected({ policy, parcel: updated.parcel, reason: 'Insurance approval was rejected.' });

    this.#auditService.record({ action: `approval_${decision.toLowerCase()}`, entity: 'approval', entityId: approvalId, actor, correlationId: updated.correlationId, previousValue: 'PENDING_APPROVAL', newValue: decision });
    return { ...updated, outcome };
  }

  list() { return this.#repository.list(); }
}
