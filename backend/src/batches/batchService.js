import { randomUUID } from 'node:crypto';
import { routeBatch, routeParcel } from '../routing.js';
import { assertPermission } from '../auth/authorization.js';
import { createIdempotencyStore } from './idempotencyStore.js';

export function createBatchService({ clock, policyStore, approvalService, auditLog }) {
  const batches = new Map();
  const idempotency = createIdempotencyStore();

  function process(parcels, { idempotencyKey, actor = 'system', role = 'OPERATOR', correlationId = randomUUID(), policyVersion } = {}) {
    assertPermission(role, 'process');
    if (!idempotencyKey) throw new Error('Idempotency key is required.');
    const reservation = idempotency.begin(idempotencyKey);
    if (reservation.state === 'completed') return { ...reservation.value, deduplicated: true };
    if (reservation.state === 'in-flight') throw new Error('Batch with this idempotency key is already processing.');
    try {
      if (!Array.isArray(parcels) || parcels.length > 5000) throw new Error('Batch must contain between 1 and 5,000 parcels.');
      const policy = policyStore.get(policyVersion);
      if (!policy || policy.state !== 'ACTIVE') throw new Error('An active policy is required.');
      const batchId = randomUUID();
      const startedAt = clock();
      const results = routeBatch(parcels, policy);
      const approvalRecords = approvalService.createForBatch({ batchId, results, correlationId });
      const finalState = results.some(({ outcome }) => outcome.status === 'error') ? 'PARTIALLY_FAILED' : 'COMPLETED';
      const record = { batchId, idempotencyKey, correlationId, state: finalState, stateHistory: ['RECEIVED', 'VALIDATING', 'PROCESSING', finalState], createdAt: startedAt.toISOString(), completedAt: clock().toISOString(), policyVersion: policy.version, results, approvalRecords, retryCount: 0, deduplicated: false };
      batches.set(idempotencyKey, record);
      idempotency.complete(idempotencyKey, record);
      auditLog.record('batch_processed', batchId, actor, correlationId, null, { state: record.state, count: results.length });
      return record;
    } catch (error) {
      idempotency.release(idempotencyKey);
      throw error;
    }
  }

  function get(id) { return [...batches.values()].find((batch) => batch.batchId === id || batch.idempotencyKey === id); }

  function retry(batchId, { actor = 'operator', role = 'OPERATOR' } = {}) {
    assertPermission(role, 'retry');
    const batch = get(batchId);
    if (!batch) throw new Error('Batch was not found.');
    const policy = policyStore.get(batch.policyVersion);
    batch.stateHistory.push('RETRYING');
    batch.results = batch.results.map(({ id, parcel, outcome }) => outcome.status === 'error' ? { id, parcel, outcome: routeParcel(parcel, policy) } : { id, parcel, outcome });
    batch.retryCount += 1;
    batch.state = batch.results.some(({ outcome }) => outcome.status === 'error') ? 'FAILED' : 'COMPLETED';
    batch.stateHistory.push(batch.state);
    auditLog.record('retry_triggered', batch.batchId, actor, batch.correlationId, 'PARTIALLY_FAILED', batch.state);
    return batch;
  }

  return { process, get, retry, list: () => [...batches.values()] };
}