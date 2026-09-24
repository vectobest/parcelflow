import test from 'node:test';
import assert from 'node:assert/strict';
import { DigitalTwinService } from '../../src/simulation/DigitalTwinService.js';

const snapshot = { totalParcels: 100, validationErrors: 5, pendingApproval: 10, averageProcessingMs: 50 };
const twin = new DigitalTwinService({ dashboardService: { snapshot: () => snapshot } });

test('projects volume, approvals and latency linearly from the current snapshot', () => {
  const result = twin.run({ volumeMultiplier: 2 });
  assert.equal(result.projected.parcels, 200);
  assert.equal(result.projected.approvals, 20);
  assert.equal(result.label, 'SIMULATION -- NOT PRODUCTION');
});

test('reduced reviewer capacity increases the projected approval queue', () => {
  const result = twin.run({ reviewerCapacityMultiplier: 0.5 });
  assert.equal(result.projected.approvals, 20);
});

test('a zero or negative multiplier is rejected rather than producing nonsense output', () => {
  assert.throws(() => twin.run({ volumeMultiplier: 0 }));
  assert.throws(() => twin.run({ processingSpeedMultiplier: -1 }));
});

test('never claims to be more than a linear projection', () => {
  const result = twin.run({});
  assert.match(result.methodology, /[Nn]ot a trained model/);
});
