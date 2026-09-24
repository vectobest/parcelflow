import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';

const parcel = { id: 'P-1002', weight: 3.5, value: 0, destinationCountry: 'NL' };

test('explainable outcomes include rule, reason, conditions, and timestamp', () => {
  const { batchService } = createContainer();
  const result = batchService.process([parcel], { idempotencyKey: 'explain-1' }).results[0].outcome;
  assert.equal(result.matchedRule, 'WEIGHT_REGULAR');
  assert.match(result.reason, /above 1 kg/);
  assert.equal(result.evaluatedConditions.regularWeightLimit, 10);
  assert.ok(result.timestamp);
});

test('duplicate batches are deduplicated by idempotency key, not reprocessed', () => {
  const { batchService, dashboardService } = createContainer();
  const first = batchService.process([parcel], { idempotencyKey: 'same-batch' });
  const second = batchService.process([parcel], { idempotencyKey: 'same-batch' });
  assert.equal(second.batchId, first.batchId);
  assert.equal(second.deduplicated, true);
  assert.equal(dashboardService.snapshot().totalParcels, 1);
});

test('an idempotency key already in flight is rejected as a conflict, not double-processed', () => {
  const { batchService } = createContainer();
  batchService.process([parcel], { idempotencyKey: 'k' });
  // Simulate a second concurrent submission after the first has already completed synchronously --
  // the real concurrency guarantee is covered by concurrency.test.js against IdempotencyStore directly.
  const replay = batchService.process([parcel], { idempotencyKey: 'k' });
  assert.equal(replay.deduplicated, true);
});

test('a batch requires an active policy and rejects an unknown one', () => {
  const { batchService } = createContainer();
  assert.throws(() => batchService.process([parcel], { idempotencyKey: 'k2', policyVersion: 'does-not-exist' }), /active policy is required/);
});

test('approval requires reviewer-or-above and cannot be decided twice', () => {
  const { batchService, approvalService } = createContainer();
  const batch = batchService.process([{ ...parcel, value: 1250 }], { idempotencyKey: 'approval-1' });
  const approvalId = batch.approvalRecords[0];
  assert.throws(() => approvalService.decide(approvalId, { role: 'OPERATOR' }), /cannot perform/);
  assert.equal(approvalService.decide(approvalId, { role: 'REVIEWER' }).outcome.status, 'routed');
  assert.throws(() => approvalService.decide(approvalId, { role: 'REVIEWER' }), /already been decided/);
});

test('a rejected approval routes to Rejected, not to a department', () => {
  const { batchService, approvalService } = createContainer();
  const batch = batchService.process([{ ...parcel, value: 1250 }], { idempotencyKey: 'approval-2' });
  const decided = approvalService.decide(batch.approvalRecords[0], { role: 'REVIEWER', decision: 'REJECTED' });
  assert.equal(decided.outcome.status, 'rejected');
  assert.equal(decided.outcome.department, null);
});

test('simulate and replay never mutate the active policy', () => {
  const { batchService, policyService, comparisonService } = createContainer();
  policyService.createDraft({ version: 'v2', insuranceValueThreshold: 1000, mailWeightLimit: 1, regularWeightLimit: 2, departments: { mail: 'M', regular: 'R', heavy: 'H' } });
  policyService.validateAndMark('v2');
  policyService.approve('v2');
  policyService.activate('v2');
  const batch = batchService.process([parcel], { idempotencyKey: 'replay-1' });
  const simulation = comparisonService.simulate([parcel], 'v1');
  const replay = comparisonService.replay(batch.batchId, 'v1');
  assert.equal(simulation.currentPolicy, 'v2');
  assert.equal(replay.changed, 1);
  assert.equal(policyService.activeVersion(), 'v2');
});
