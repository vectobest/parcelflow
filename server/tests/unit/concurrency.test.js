import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncGate } from '../../src/concurrency/AsyncGate.js';
import { IdempotencyStore } from '../../src/batches/IdempotencyStore.js';

test('async gate never exceeds its configured concurrency', async () => {
  const gate = new AsyncGate({ limit: 2 });
  let active = 0;
  let peak = 0;
  const jobs = Array.from({ length: 8 }, (_, index) => gate.run(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, index % 2));
    active -= 1;
  }));
  await Promise.all(jobs);
  assert.equal(peak, 2);
  assert.equal(gate.active(), 0);
});

test('idempotency store serializes in-flight keys and replays completed values', () => {
  const store = new IdempotencyStore();
  assert.equal(store.begin('batch-1').state, 'reserved');
  assert.equal(store.begin('batch-1').state, 'in-flight');
  store.complete('batch-1', { state: 'COMPLETED' });
  assert.deepEqual(store.begin('batch-1'), { state: 'completed', value: { state: 'COMPLETED' } });
});

test('a released reservation (failed attempt) can be retried under the same key', () => {
  const store = new IdempotencyStore();
  store.begin('batch-2');
  store.release('batch-2');
  assert.equal(store.begin('batch-2').state, 'reserved');
});
