import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoPolicyRepository } from '../../src/db/mongoRepositories.js';
import { POLICY_STATES } from '../../src/domain/Policy.js';

/**
 * A real MongoBackedMap.hydrate() populates its map with plain objects rebuilt from Mongo
 * documents, never the original Policy instances (see MongoBackedMap.js). This fakes exactly
 * that shape -- a plain Map holding a plain object -- without needing a real database, to
 * reproduce the bug this repository exists to fix: PolicyService calls `.withState()` on
 * whatever a repository hands back, and a plain object has no such method.
 */
function hydratedLikeMap(entries) {
  return new Map(entries.map((doc) => [doc.version, { ...doc }]));
}

test('get() returns a real Policy instance, even for a value that was never a Policy to begin with', () => {
  const map = hydratedLikeMap([{ version: 'v1', mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 1000, departments: { mail: 'M', regular: 'R', heavy: 'H' }, state: POLICY_STATES.ROLLED_BACK }]);
  const repository = new MongoPolicyRepository(map);

  const policy = repository.get('v1');
  assert.doesNotThrow(() => policy.withState(POLICY_STATES.ACTIVE), 'a policy loaded after a restart must support the same instance methods as one created in-process');
  assert.equal(policy.withState(POLICY_STATES.ACTIVE).state, POLICY_STATES.ACTIVE);
});

test('list() reconstructs every entry, not just the one looked up by get()', () => {
  const map = hydratedLikeMap([
    { version: 'v1', mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 1000, departments: {}, state: POLICY_STATES.ROLLED_BACK },
    { version: 'v2', mailWeightLimit: 1, regularWeightLimit: 10, insuranceValueThreshold: 1000, departments: {}, state: POLICY_STATES.ACTIVE }
  ]);
  const repository = new MongoPolicyRepository(map);
  const [first, second] = repository.list();
  assert.doesNotThrow(() => first.withState(POLICY_STATES.ACTIVE));
  assert.doesNotThrow(() => second.withState(POLICY_STATES.ROLLED_BACK));
});

test('save() still works with a real Policy instance, unaffected by the read-side fix', () => {
  const map = new Map();
  const repository = new MongoPolicyRepository(map);
  repository.save({ version: 'v1', state: POLICY_STATES.DRAFT });
  assert.equal(map.get('v1').version, 'v1');
  assert.equal(repository.has('v1'), true);
});
