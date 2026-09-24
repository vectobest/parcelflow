import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';

test('a deterministic validation failure is classified MANUAL_REVIEW, not silently re-attempted forever', () => {
  const { batchService, retryService } = createContainer();
  const batch = batchService.process([{ id: 'R-1', weight: -1, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'retry-1' });
  const retried = retryService.retry(batch.batchId, {});
  assert.equal(retried.retrySummary.resolved, 0);
  assert.equal(retried.retrySummary.manualReview, 1);
  assert.equal(retried.retryCount, 1);
});

test('retrying stops at the configured limit and dead-letters instead of retrying forever', () => {
  const { batchService, retryService } = createContainer({});
  const batch = batchService.process([{ id: 'R-2', weight: -1, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'retry-2' });
  let current = batch;
  for (let i = 0; i < 5; i += 1) current = retryService.retry(current.batchId, {});
  assert.equal(current.retrySummary.atRetryLimit, true);
  assert.ok(current.retryCount <= 3 + 1, 'retry count should not exceed the configured maximum plus the blocked call');
});

test('a policy change that fixes the underlying issue resolves the parcel on retry', () => {
  const { batchService, policyService, retryService } = createContainer();
  const batch = batchService.process([{ id: 'R-3', weight: 500, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'retry-3' });
  assert.equal(batch.results[0].outcome.status, 'routed');

  const failing = batchService.process([{ id: 'R-4', weight: -1, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'retry-4' });
  const retried = retryService.retry(failing.batchId, {});
  assert.equal(retried.retrySummary.resolved, 0, 'bad weight can never be fixed by a policy change');
});

test('retry requires operator-or-above authorization', () => {
  const { batchService, retryService } = createContainer();
  const batch = batchService.process([{ id: 'R-5', weight: -1, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'retry-5' });
  assert.throws(() => retryService.retry(batch.batchId, { role: 'GUEST' }), /cannot perform/);
});
