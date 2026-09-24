import test from 'node:test';
import assert from 'node:assert/strict';
import { RoutingEngine, DEFAULT_POLICY } from '../../src/routing/RoutingEngine.js';

const engine = new RoutingEngine();
const validParcel = { weight: 1, value: 0, destinationCountry: 'NL' };

test('routes the documented weight boundaries', () => {
  assert.equal(engine.route(validParcel).department, 'Mail Department');
  assert.equal(engine.route({ ...validParcel, weight: 1.01 }).department, 'Regular Department');
  assert.equal(engine.route({ ...validParcel, weight: 10 }).department, 'Regular Department');
  assert.equal(engine.route({ ...validParcel, weight: 10.01 }).department, 'Heavy Department');
});

test('holds high-value parcels for insurance approval before routing', () => {
  const result = engine.route({ ...validParcel, weight: 0.2, value: 1000.01 });
  assert.equal(result.status, 'pending');
  assert.equal(result.department, 'Insurance Approval');
});

test('exactly the insurance threshold does not require approval', () => {
  assert.equal(engine.route({ ...validParcel, value: 1000 }).status, 'routed');
});

test('rejects invalid input instead of guessing a route', () => {
  assert.equal(engine.route({ ...validParcel, weight: -1 }).status, 'error');
  assert.equal(engine.route({ ...validParcel, value: 'not money' }).status, 'error');
  assert.equal(engine.route({ weight: 1, value: 0 }).status, 'error');
});

test('a custom policy does not mutate the default policy', () => {
  const policy = { version: 'pilot', insuranceValueThreshold: 500, mailWeightLimit: 2, regularWeightLimit: 20, departments: DEFAULT_POLICY.departments };
  assert.equal(engine.route({ ...validParcel, value: 501 }, policy).status, 'pending');
  assert.equal(engine.route({ ...validParcel, weight: 2 }, policy).department, 'Mail Department');
  assert.equal(engine.route({ ...validParcel, weight: 2 }).department, 'Regular Department');
});

test('routes every item in a batch and preserves a stable id', () => {
  const results = engine.routeBatch([{ id: 'A-1', ...validParcel }, { id: 'A-2', ...validParcel, weight: 12 }]);
  assert.deepEqual(results.map(({ id, outcome }) => [id, outcome.department]), [['A-1', 'Mail Department'], ['A-2', 'Heavy Department']]);
});

test('a new rule can be inserted without touching the engine (Open/Closed)', () => {
  const extended = new RoutingEngine();
  let called = false;
  extended.addRule({ evaluate: () => { called = true; return null; } }, { before: 'MailWeightRule' });
  extended.route(validParcel);
  assert.equal(called, true);
});
