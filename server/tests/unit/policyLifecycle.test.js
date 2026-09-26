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

function activateVersion(policyService, version, overrides = {}) {
  policyService.createDraft({ ...DEFAULT_POLICY, ...overrides, version });
  policyService.validateAndMark(version);
  policyService.approve(version);
  return policyService.activate(version);
}

test('more than one policy can be active at the same time: activating a new one never touches another', () => {
  const { policyService } = createContainer();
  activateVersion(policyService, 'v2', { regularWeightLimit: 8 });
  assert.equal(policyService.get('v1').state, POLICY_STATES.ACTIVE, 'v1 must still be active -- activating v2 is not a rollback of v1');
  assert.equal(policyService.get('v2').state, POLICY_STATES.ACTIVE);
  assert.deepEqual(policyService.listActive().map((p) => p.version).sort(), ['v1', 'v2']);
});

test('rolling back one active policy never activates or otherwise touches any other', () => {
  const { policyService } = createContainer();
  activateVersion(policyService, 'v2', { regularWeightLimit: 8 });
  policyService.rollback('v2');
  assert.equal(policyService.get('v1').state, POLICY_STATES.ACTIVE, 'rolling back v2 must not reactivate or re-touch v1');
  assert.equal(policyService.get('v2').state, POLICY_STATES.ROLLED_BACK);
  assert.deepEqual(policyService.listActive().map((p) => p.version), ['v1']);
});

test('the single-default pointer moves to the next-newest active policy after a rollback, or to none if it was the only one', () => {
  const { policyService } = createContainer();
  activateVersion(policyService, 'v2', { regularWeightLimit: 8 });
  assert.equal(policyService.activeVersion(), 'v2', 'the default pointer is the most recently activated one');
  policyService.rollback('v2');
  assert.equal(policyService.activeVersion(), 'v1', 'v1 is still active, so it becomes the new default');
  policyService.rollback('v1');
  assert.equal(policyService.activeVersion(), null, 'nothing is active any more');
});

test('an admin can reactivate a specific, previously rolled-back version directly', () => {
  const { policyService } = createContainer();
  activateVersion(policyService, 'v2', { regularWeightLimit: 8 });
  activateVersion(policyService, 'v3', { regularWeightLimit: 8 });
  policyService.rollback('v1');
  policyService.rollback('v2');
  // v1 and v2 are both rolled back now, v3 is active. Reactivate v1 specifically.
  const reactivated = policyService.activate('v1');
  assert.equal(reactivated.state, POLICY_STATES.ACTIVE);
  assert.equal(policyService.get('v2').state, POLICY_STATES.ROLLED_BACK, 'untouched, still rolled back');
  assert.equal(policyService.get('v3').state, POLICY_STATES.ACTIVE, 'untouched, still active');
  assert.deepEqual(policyService.listActive().map((p) => p.version).sort(), ['v1', 'v3']);
});

test('only an active policy can be rolled back, but any currently active one, not just the single-default pointer', () => {
  const { policyService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });
  assert.throws(() => policyService.rollback('v2'), /Only an active policy can be rolled back/);

  activateVersion(policyService, 'v3', { regularWeightLimit: 9 });
  assert.equal(policyService.activeVersion(), 'v3');
  assert.doesNotThrow(() => policyService.rollback('v1'), 'v1 is active, just not the newest -- it must still be rollback-able directly');
  assert.equal(policyService.get('v3').state, POLICY_STATES.ACTIVE, 'untouched');
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

test('withState stamps the real timestamp field for every state, not a computed near-miss', () => {
  const { policyService } = createContainer();
  policyService.createDraft({ ...DEFAULT_POLICY, version: 'v2', regularWeightLimit: 8 });
  const validated = policyService.validateAndMark('v2').policy;
  assert.ok(validated.validatedAt);
  const approved = policyService.approve('v2');
  assert.ok(approved.approvedAt);
  const activated = policyService.activate('v2');
  assert.ok(activated.activatedAt, 'ACTIVE must stamp activatedAt, not a throwaway "activeAt"');
  const rolledBack = policyService.rollback('v2');
  assert.ok(rolledBack.rolledBackAt, 'ROLLED_BACK must stamp rolledBackAt, not a throwaway "rolled_backAt"');
});

test('bootstrap() never re-seeds or overwrites a repository that already has history', () => {
  const injected = new Map();
  const policyRepository = {
    get: (v) => injected.get(v),
    list: () => [...injected.values()],
    save: (p) => { injected.set(p.version, p); return p; },
    has: (v) => injected.has(v)
  };
  // Pre-populate as if a persistent store had survived a restart: v1 rolled back, v2 genuinely active.
  policyRepository.save({ version: 'v1', mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 1000, departments: {}, state: POLICY_STATES.ROLLED_BACK, activatedAt: '2026-01-01T00:00:00.000Z', rolledBackAt: '2026-01-02T00:00:00.000Z' });
  policyRepository.save({ version: 'v2', mailWeightLimit: 2, regularWeightLimit: 8, insuranceValueThreshold: 1500, departments: { mail: 'M', regular: 'R', heavy: 'H' }, state: POLICY_STATES.ACTIVE, activatedAt: '2026-01-02T00:00:00.000Z' });

  const { policyService } = createContainer({ repositories: { policyRepository } });
  assert.equal(policyService.activeVersion(), 'v2', 'bootstrap must recover the real active version instead of forcing v1 active');
  assert.equal(policyService.get('v1').state, POLICY_STATES.ROLLED_BACK, 'bootstrap must not overwrite an existing v1 with a fresh, forced-active copy');
});
