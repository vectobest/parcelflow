import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY } from '../src/routing.js';
import { POLICY_STATES, createPolicyStore, validatePolicy } from '../src/policy.js';
import { createOperations } from '../src/operations.js';

const parcel = { id: 'P-1002', weight: 3.5, value: 0, destinationCountry: 'NL' };

test('explainable outcomes include rule, reason, conditions, and timestamp', () => {
  const result = createOperations().processBatch([parcel], { idempotencyKey: 'explain-1' }).results[0].outcome;

  assert.equal(result.matchedRule, 'WEIGHT_REGULAR');
  assert.match(result.reason, /above 1 kg/);
  assert.equal(result.evaluatedConditions.regularWeightLimit, 10);
  assert.ok(result.timestamp);
  assert.equal(result.parcelId, 'P-1002');
});

test('invalid policies cannot be activated', () => {
  const store = createPolicyStore(DEFAULT_POLICY);
  const draft = store.createDraft({ ...DEFAULT_POLICY, version: 'v2', mailWeightLimit: 10, regularWeightLimit: 1 });

  assert.equal(draft.validation.valid, false);
  assert.equal(store.validateAndMark('v2').valid, false);
  assert.throws(() => store.activate('v2'), /Only approved policies/);
  assert.equal(store.activeVersion(), 'v1');
  assert.equal(validatePolicy({ ...DEFAULT_POLICY, version: 'bad', departments: { mail: '', regular: 'Regular', heavy: 'Heavy' } }).valid, false);
});

test('policy lifecycle is versioned and active policies are immutable', () => {
  const store = createPolicyStore(DEFAULT_POLICY);
  store.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });
  assert.equal(store.validateAndMark('v2').policy.state, POLICY_STATES.VALIDATED);
  assert.equal(store.approve('v2').state, POLICY_STATES.APPROVED);
  assert.equal(store.activate('v2').state, POLICY_STATES.ACTIVE);
  assert.equal(store.activeVersion(), 'v2');
  assert.throws(() => store.activate('v1'), /immutable/);
});

test('duplicate batches are deduplicated by idempotency key', () => {
  const operations = createOperations();
  const first = operations.processBatch([parcel], { idempotencyKey: 'same-batch' });
  const second = operations.processBatch([parcel], { idempotencyKey: 'same-batch' });

  assert.equal(second.batchId, first.batchId);
  assert.equal(second.deduplicated, true);
  assert.equal(operations.dashboard().totalParcels, 1);
});

test('approval requires reviewer role and cannot be decided twice', () => {
  const operations = createOperations();
  const batch = operations.processBatch([{ ...parcel, value: 1250 }], { idempotencyKey: 'approval-1' });
  const approvalId = batch.approvalRecords[0];

  assert.throws(() => operations.approveApproval(approvalId, { role: 'OPERATOR' }), /cannot perform/);
  assert.equal(operations.approveApproval(approvalId).outcome.status, 'routed');
  assert.throws(() => operations.approveApproval(approvalId), /already been decided/);
});

test('simulation and replay do not mutate the active policy', () => {
  const operations = createOperations();
  operations.policyStore.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 2 });
  operations.policyStore.validateAndMark('v2');
  operations.policyStore.approve('v2');
  operations.policyStore.activate('v2');
  const batch = operations.processBatch([parcel], { idempotencyKey: 'replay-1' });
  const simulation = operations.simulate([parcel], 'v1');
  const replay = operations.replay(batch.batchId, 'v1');

  assert.equal(simulation.currentPolicy, 'v2');
  assert.equal(simulation.changed.length, 1);
  assert.equal(replay.changed, 1);
  assert.equal(operations.policyStore.activeVersion(), 'v2');
});