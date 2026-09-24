import { NotFoundError } from '../errors/index.js';

export const RETRY_CLASSIFICATIONS = Object.freeze({
  RESOLVED: 'RESOLVED',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  DEAD_LETTER: 'DEAD_LETTER'
});

/**
 * Bounded, idempotent, auditable retry for failed parcels within a batch
 * (master prompt section 25). This routing engine is a pure function of
 * (parcel, policy), so a structurally invalid parcel (bad weight/value/
 * country) will fail identically every time it is retried -- retrying it
 * blindly would be "retry theater," not reliability engineering. Retrying
 * re-evaluates each failed parcel against the *current* active policy (it
 * may have changed since the original attempt) and classifies what's
 * still wrong rather than silently looping:
 *
 *   RESOLVED       the parcel now routes successfully
 *   MANUAL_REVIEW  still fails; the data itself needs a human fix
 *   DEAD_LETTER    exhausted the retry budget for this batch; stop auto-retrying
 */
export class RetryService {
  #batchRepository;
  #routingEngine;
  #policyService;
  #approvalService;
  #auditService;
  #authorizationService;
  #clock;
  #maxRetries;

  constructor({ batchRepository, routingEngine, policyService, approvalService, auditService, authorizationService, clock = () => new Date(), maxRetries = 3 }) {
    this.#batchRepository = batchRepository;
    this.#routingEngine = routingEngine;
    this.#policyService = policyService;
    this.#approvalService = approvalService;
    this.#auditService = auditService;
    this.#authorizationService = authorizationService;
    this.#clock = clock;
    this.#maxRetries = maxRetries;
  }

  retry(batchId, { actor = 'operator', role = 'OPERATOR', correlationId } = {}) {
    this.#authorizationService.assertPermission(role, 'retry');
    const batch = this.#batchRepository.list().find((b) => b.batchId === batchId);
    if (!batch) throw new NotFoundError('Batch was not found.');

    if (batch.retryCount >= this.#maxRetries) {
      this.#auditService.record({ action: 'retry_blocked_dead_letter', entity: 'batch', entityId: batchId, actor, correlationId, metadata: { retryCount: batch.retryCount } });
      return { ...batch, retrySummary: { resolved: 0, manualReview: 0, deadLetter: batch.results.filter((r) => r.outcome.status === 'error').length, atRetryLimit: true } };
    }

    const policy = this.#policyService.getActive();
    const summary = { resolved: 0, manualReview: 0, deadLetter: 0 };
    const nextRetryCount = batch.retryCount + 1;

    const results = batch.results.map(({ id, parcel, outcome }) => {
      if (outcome.status !== 'error') return { id, parcel, outcome };
      const reRouted = this.#routingEngine.route(parcel, policy);
      if (reRouted.status !== 'error') {
        summary.resolved += 1;
        return { id, parcel, outcome: reRouted };
      }
      const classification = nextRetryCount >= this.#maxRetries ? RETRY_CLASSIFICATIONS.DEAD_LETTER : RETRY_CLASSIFICATIONS.MANUAL_REVIEW;
      if (classification === RETRY_CLASSIFICATIONS.DEAD_LETTER) summary.deadLetter += 1; else summary.manualReview += 1;
      return { id, parcel, outcome: { ...reRouted, retryClassification: classification } };
    });

    const stillFailing = results.some(({ outcome }) => outcome.status === 'error');
    const updated = {
      ...batch,
      results,
      retryCount: nextRetryCount,
      stateHistory: [...batch.stateHistory, 'RETRYING', stillFailing ? 'PARTIALLY_FAILED' : 'COMPLETED'],
      state: stillFailing ? 'PARTIALLY_FAILED' : 'COMPLETED'
    };
    this.#batchRepository.save(updated);
    this.#auditService.record({ action: 'retry_completed', entity: 'batch', entityId: batchId, actor, correlationId: correlationId || batch.correlationId, previousValue: 'PARTIALLY_FAILED', newValue: updated.state, metadata: summary });
    return { ...updated, retrySummary: { ...summary, atRetryLimit: nextRetryCount >= this.#maxRetries } };
  }
}
