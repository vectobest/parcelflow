import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';

test('every security drill scenario is genuinely blocked by real security code', () => {
  const { securityDrillService } = createContainer();
  const report = securityDrillService.runAll({ actor: 'test-admin' });
  assert.equal(report.status, 'PROTECTED');
  assert.equal(report.results.length, 8);
  for (const result of report.results) {
    assert.equal(result.blocked, true, `${result.scenario} should have been blocked: ${result.detail}`);
  }
});

test('the security drill records an audit event tagged as a drill', () => {
  const { securityDrillService, auditService } = createContainer();
  securityDrillService.runAll({ actor: 'test-admin' });
  const event = auditService.list().find((e) => e.action === 'security_drill_run');
  assert.ok(event);
  assert.equal(event.metadata.drill, true);
});

test('the chaos drill runs the real incident lifecycle without touching real batches', () => {
  const { chaosDrillService, batchService } = createContainer();
  const drill = chaosDrillService.run('PARSER_FAILURE', { actor: 'test-admin' });
  assert.deepEqual(drill.steps.map((s) => s.stage), ['FAILURE', 'DETECTION', 'INCIDENT', 'SAFE_DEGRADATION', 'RECOVERY', 'AUDIT']);
  assert.equal(drill.label, 'SIMULATION -- NOT PRODUCTION');
  assert.equal(batchService.list().length, 0, 'a drill must never create a real batch');
});

test('an unknown chaos scenario is rejected', () => {
  const { chaosDrillService } = createContainer();
  assert.throws(() => chaosDrillService.run('NOT_A_REAL_SCENARIO'), /Unknown chaos scenario/);
});
