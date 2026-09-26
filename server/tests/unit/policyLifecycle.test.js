import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';
import { DEFAULT_POLICY } from '../../src/routing/RoutingEngine.js';
import { POLICY_STATES } from '../../src/domain/Policy.js';

test('invalid drafts cannot be validated or approved', () => {
  const { policyService } = createContainer();
  const { validation } = policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', mailWeightLimit: 10, regularWeightLimit: 1 });
  assert.equal(validation.valid, false);
  assert.equal(policyService.validateAndMark('v2').valid, false);
  assert.throws(() => policyService.approve('v2'), /Only validated policies/);
});

test('policy lifecycle is versioned: draft -> validated -> approved -> active', () => {
  const { policyService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });
  assert.equal(policyService.validateAndMark('v2').policy.state, POLICY_STATES.VALIDATED);
  assert.equal(policyService.approve('v2').state, POLICY_STATES.APPROVED);
  assert.equal(policyService.activate('v2').state, POLICY_STATES.ACTIVE);
  assert.equal(policyService.activeVersion(), 'v2');
});

test('active policies are immutable; the only way to change one is a new version', () => {
  const { policyService } = createContainer();
  assert.throws(() => policyService.activate('v1'), /immutable/);
});

test('rollback restores the previous active policy', () => {
  const { policyService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });
  policyService.validateAndMark('v2');
  policyService.approve('v2');
  policyService.activate('v2');
  policyService.rollback('v2');
  assert.equal(policyService.activeVersion(), 'v1');
});

test('rule conflict detector flags overlapping weight tiers and dominant insurance thresholds', () => {
  const { ruleConflictDetector } = createContainer();
  const overlapping = ruleConflictDetector.analyze({ mailWeightLimit: 10, regularWeightLimit: 5, insuranceValueThreshold: 1000, departments: { mail: 'M', regular: 'R', heavy: 'H' } });
  assert.equal(overlapping.hasConflicts, true);

  const dominated = ruleConflictDetector.analyze({ mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 0, departments: { mail: 'M', regular: 'R', heavy: 'H' } });
  assert.equal(dominated.hasConflicts, false);
  assert.equal(dominated.hasWarnings, true);
  assert.ok(dominated.findings.some((f) => f.code === 'INSURANCE_DOMINATES'));
});

test('blast radius reports "no history yet" before any batch is processed', () => {
  const { policyService, policyBlastRadiusService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 5 });
  const result = policyBlastRadiusService.analyze('v2');
  assert.equal(result.historicalParcels, 0);
  assert.match(result.recommendation, /No historical parcels/);
});

test('blast radius counts real decision changes across historical parcels', () => {
  const { policyService, batchService, policyBlastRadiusService } = createContainer();
  batchService.process([{ id: 'X-1', weight: 7, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'k1' });
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 5 });
  const result = policyBlastRadiusService.analyze('v2');
  assert.equal(result.historicalParcels, 1);
  assert.equal(result.changed.length, 1);
  assert.equal(result.changed[0].from, 'Regular Department');
  assert.equal(result.changed[0].to, 'Heavy Department');
});

test('createContainer() uses an injected repository in place of its in-memory default', () => {
  const injectedPolicies = new Map();
  const policyRepository = {
    get: (v) => injectedPolicies.get(v),
    list: () => [...injectedPolicies.values()],
    save: (p) => { injectedPolicies.set(p.version, p); return p; },
    has: (v) => injectedPolicies.has(v)
  };
  const { policyService } = createContainer({ repositories: { policyRepository } });
  assert.equal(policyService.activeVersion(), 'v1');
  assert.ok(injectedPolicies.has('v1'), 'the bootstrap policy was written through the injected repository, not a private in-memory one');
});
