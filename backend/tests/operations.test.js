import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../src/container.js';
import { DEFAULT_POLICY } from '../src/routing/RoutingEngine.js';
import { POLICY_STATES } from '../src/domain/Policy.js';

const parcel = { id: 'P-1002', weight: 3.5, value: 0, destinationCountry: 'NL' };

test('explainable outcomes include rule, reason, conditions, and timestamp', () => {
  const { batchService } = createContainer();
  const result = batchService.process([parcel], { idempotencyKey: 'explain-1' }).results[0].outcome;

  assert.equal(result.matchedRule, 'WEIGHT_REGULAR');
  assert.match(result.reason, /above 1 kg/);
  assert.equal(result.evaluatedConditions.regularWeightLimit, 10);
  assert.ok(result.timestamp);
  assert.equal(result.parcelId, 'P-1002');
});

test('invalid policies cannot be activated', () => {
  const { policyService } = createContainer();
  const { validation } = policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', mailWeightLimit: 10, regularWeightLimit: 1 });

  assert.equal(validation.valid, false);
  assert.equal(policyService.validateAndMark('v2').valid, false);
  assert.throws(() => policyService.approve('v2'), /Only validated policies/);
  assert.equal(policyService.activeVersion(), 'v1');
});

test('policy lifecycle is versioned and active policies are immutable', () => {
  const { policyService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });

  assert.equal(policyService.validateAndMark('v2').policy.state, POLICY_STATES.VALIDATED);
  assert.equal(policyService.approve('v2').state, POLICY_STATES.APPROVED);
  assert.equal(policyService.activate('v2').state, POLICY_STATES.ACTIVE);
  assert.equal(policyService.activeVersion(), 'v2');
  assert.throws(() => policyService.activate('v1'), /immutable/);
});

test('duplicate batches are deduplicated by idempotency key', () => {
  const { batchService, dashboardService } = createContainer();
  const first = batchService.process([parcel], { idempotencyKey: 'same-batch' });
  const second = batchService.process([parcel], { idempotencyKey: 'same-batch' });

  assert.equal(second.batchId, first.batchId);
  assert.equal(second.deduplicated, true);
  assert.equal(dashboardService.snapshot().totalParcels, 1);
});

test('approval requires reviewer role and cannot be decided twice', () => {
  const { batchService, approvalService } = createContainer();
  const batch = batchService.process([{ ...parcel, value: 1250 }], { idempotencyKey: 'approval-1' });
  const approvalId = batch.approvalRecords[0];

  assert.throws(() => approvalService.decide(approvalId, { role: 'OPERATOR' }), /cannot perform/);
  assert.equal(approvalService.decide(approvalId, { role: 'REVIEWER' }).outcome.status, 'routed');
  assert.throws(() => approvalService.decide(approvalId, { role: 'REVIEWER' }), /already been decided/);
});

test('simulation and replay do not mutate the active policy', () => {
  const { batchService, policyService, comparisonService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 2 });
  policyService.validateAndMark('v2');
  policyService.approve('v2');
  policyService.activate('v2');
  const batch = batchService.process([parcel], { idempotencyKey: 'replay-1' });
  const simulation = comparisonService.simulate([parcel], 'v1');
  const replay = comparisonService.replay(batch.batchId, 'v1');

  assert.equal(simulation.currentPolicy, 'v2');
  assert.equal(simulation.changed.length, 1);
  assert.equal(replay.changed, 1);
  assert.equal(policyService.activeVersion(), 'v2');
});
