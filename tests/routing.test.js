import test from 'node:test';
import assert from 'node:assert/strict';
import { routeParcel, routeBatch } from '../src/routing.js';

const validParcel = { weight: 1, value: 0, destinationCountry: 'NL' };

test('routes the documented weight boundaries', () => {
  assert.equal(routeParcel(validParcel).department, 'Mail Department');
  assert.equal(routeParcel({ ...validParcel, weight: 1.01 }).department, 'Regular Department');
  assert.equal(routeParcel({ ...validParcel, weight: 10 }).department, 'Regular Department');
  assert.equal(routeParcel({ ...validParcel, weight: 10.01 }).department, 'Heavy Department');
});

test('holds high-value parcels for insurance approval before routing', () => {
  const result = routeParcel({ ...validParcel, weight: 0.2, value: 1000.01 });

  assert.equal(result.status, 'pending');
  assert.equal(result.department, 'Insurance Approval');
});

test('exactly the insurance threshold does not require approval', () => {
  assert.equal(routeParcel({ ...validParcel, value: 1000 }).status, 'routed');
});

test('rejects invalid input instead of guessing a route', () => {
  assert.equal(routeParcel({ ...validParcel, weight: -1 }).status, 'error');
  assert.equal(routeParcel({ ...validParcel, value: 'not money' }).status, 'error');
  assert.equal(routeParcel({ weight: 1, value: 0 }).status, 'error');
});

test('uses a supplied policy without changing the default policy', () => {
  const policy = { version: 'pilot', insuranceValueThreshold: 500, mailWeightLimit: 2, regularWeightLimit: 20 };

  assert.equal(routeParcel({ ...validParcel, value: 501 }, policy).status, 'pending');
  assert.equal(routeParcel({ ...validParcel, weight: 2 }, policy).department, 'Mail Department');
  assert.equal(routeParcel({ ...validParcel, weight: 2 }).department, 'Regular Department');
});

test('routes every item in a batch and preserves a stable id', () => {
  const results = routeBatch([
    { id: 'A-1', ...validParcel },
    { id: 'A-2', ...validParcel, weight: 12 }
  ]);

  assert.deepEqual(results.map(({ id, outcome }) => [id, outcome.department]), [
    ['A-1', 'Mail Department'],
    ['A-2', 'Heavy Department']
  ]);
});