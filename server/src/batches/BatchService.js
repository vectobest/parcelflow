import { randomUUID } from 'node:crypto';
import { ValidationError, ConflictError } from '../errors/index.js';
import { IdempotencyStore } from './IdempotencyStore.js';

/**
 * Orchestrates batch processing: validates the request, routes every
 * parcel through the RoutingEngine, opens approval records for anything
 * pending, and records the outcome. Everything it needs is injected, so
 * it is fully unit-testable without an HTTP server or a clock (DIP).
 *
 * Retrying a failed batch is a separate concern owned by RetryService
 * (SRP) -- this class only ever creates a batch, it never mutates one.
 */
export class BatchService {
  #repository;
  #routingEngine;
  #policyService;
  #approvalService;
  #auditService;
  #authorizationService;
  #idempotency;
  #clock;
  #maxBatchSize;

  constructor({
    repository,
    routingEngine,
    policyService,
    approvalService,
    auditService,
    authorizationService,
    idempotencyStore = new IdempotencyStore(),
    clock = () => new Date(),
    maxBatchSize = 5000
  }) {
    this.#repository = repository;
    this.#routingEngine = routingEngine;
    this.#policyService = policyService;
    this.#approvalService = approvalService;
    this.#auditService = auditService;
    this.#authorizationService = authorizationService;
    this.#idempotency = idempotencyStore;
    this.#clock = clock;
    this.#maxBatchSize = maxBatchSize;
  }

  process(parcels, { idempotencyKey, actor = 'system', role = 'OPERATOR', correlationId = randomUUID(), policyVersion, source = 'manual' } = {}) {
    this.#authorizationService.assertPermission(role, 'process');
    if (!idempotencyKey) throw new ValidationError('Idempotency key is required.');

    const reservation = this.#idempotency.begin(idempotencyKey);
    if (reservation.state === 'completed') return { ...reservation.value, deduplicated: true };
    if (reservation.state === 'in-flight') throw new ConflictError('Batch with this idempotency key is already processing.');

    try {
      if (!Array.isArray(parcels) || parcels.length < 1 || parcels.length > this.#maxBatchSize) {
        throw new ValidationError(`Batch must contain between 1 and ${this.#maxBatchSize} parcels.`);
      }
      const policy = this.#policyService.get(policyVersion);
      if (!policy || policy.state !== 'ACTIVE') throw new ValidationError('An active policy is required.');

      const batchId = randomUUID();
      const startedAt = this.#clock();
      const results = this.#routingEngine.routeBatch(parcels, policy);
      const approvalRecords = this.#approvalService.createForBatch({ batchId, results, correlationId });
      const finalState = results.some(({ outcome }) => outcome.status === 'error') ? 'PARTIALLY_FAILED' : 'COMPLETED';

      const record = {
        batchId,
        idempotencyKey,
        correlationId,
        source,
        actor,
        state: finalState,
        stateHistory: ['RECEIVED', 'VALIDATING', 'PROCESSING', finalState],
        createdAt: startedAt.toISOString(),
        completedAt: this.#clock().toISOString(),
        policyVersion: policy.version,
        results,
        approvalRecords,
        retryCount: 0,
        deduplicated: false
      };

      this.#repository.save(record);
      this.#idempotency.complete(idempotencyKey, record);
      this.#auditService.record({ action: 'batch_processed', entity: 'batch', entityId: batchId, actor, correlationId, newValue: { state: record.state, count: results.length } });
      return record;
    } catch (error) {
      this.#idempotency.release(idempotencyKey);
      throw error;
    }
  }

  get(id) {
    return this.#repository.list().find((batch) => batch.batchId === id || batch.idempotencyKey === id);
  }

  list() { return this.#repository.list(); }
}
