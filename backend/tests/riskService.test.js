import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiskService } from '../src/intelligence/riskService.js';

const batch = (results) => ({ results });
const routed = { outcome: { status: 'routed' } };
const invalid = { outcome: { status: 'error' } };
const pending = { outcome: { status: 'pending' } };

test('risk engine reports insufficient data instead of inventing a prediction', () => {
  const risk = createRiskService({ batchService: { list: () => [batch([routed])] } }).assess();

  assert.equal(risk.level, 'INSUFFICIENT_DATA');
  assert.equal(risk.confidence, 0);
});

test('risk engine explains a rising validation-failure trend', () => {
  const risk = createRiskService({ batchService: { list: () => [batch([routed, routed, routed, routed]), batch([invalid, invalid, routed, routed])] } }).assess();

  assert.equal(risk.level, 'MEDIUM');
  assert.match(risk.evidence[0], /increased/);
  assert.match(risk.recommendation, /upstream parcel feed/);
});

test('risk engine detects simultaneous failure and approval-backlog growth', () => {
  const risk = createRiskService({ batchService: { list: () => [batch([routed, routed]), batch([invalid, pending, pending])] } }).assess();

  assert.equal(risk.level, 'HIGH');
  assert.equal(risk.evidence.length, 2);
});