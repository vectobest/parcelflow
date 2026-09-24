import test from 'node:test';
import assert from 'node:assert/strict';
import { RiskService } from '../../src/intelligence/RiskService.js';
import { FailureDnaService } from '../../src/intelligence/FailureDnaService.js';
import { IncidentDetectorService } from '../../src/intelligence/IncidentDetectorService.js';
import { InMemoryIncidentRepository } from '../../src/intelligence/InMemoryIncidentRepository.js';
import { InMemoryAuditRepository } from '../../src/audit/InMemoryAuditRepository.js';
import { AuditService } from '../../src/audit/AuditService.js';

const batch = (results) => ({ results });
const routed = { outcome: { status: 'routed' } };
const invalid = { outcome: { status: 'error', reason: 'Weight must be a non-negative number.' } };

test('risk engine reports insufficient data instead of inventing a prediction', () => {
  const risk = new RiskService({ batchService: { list: () => [batch([routed])] }, approvalService: { list: () => [] } }).assess();
  assert.equal(risk.level, 'INSUFFICIENT_DATA');
  assert.equal(risk.confidence, 0);
});

test('risk engine explains a rising validation-failure trend', () => {
  const risk = new RiskService({
    batchService: { list: () => [batch([routed, routed, routed, routed]), batch([invalid, invalid, routed, routed])] },
    approvalService: { list: () => [] }
  }).assess();
  assert.equal(risk.level, 'MEDIUM');
  assert.match(risk.evidence[0], /increased/);
});

test('failure DNA groups failures by fingerprint and reports a trend', () => {
  const batches = [{ createdAt: '2026-01-01', results: [invalid, invalid, routed] }, { createdAt: '2026-01-02', results: [invalid, invalid, invalid] }];
  const dna = new FailureDnaService({ batchService: { list: () => batches } }).analyze();
  assert.equal(dna.totalFailures, 5);
  assert.equal(dna.categories[0].code, 'MISSING_OR_INVALID_WEIGHT');
  assert.equal(dna.categories[0].count, 5);
});

test('a batch below the minimum size never opens an incident, however bad its failure rate', () => {
  const auditService = new AuditService({ repository: new InMemoryAuditRepository() });
  const detector = new IncidentDetectorService({
    repository: new InMemoryIncidentRepository(),
    batchService: { list: () => [] },
    failureDnaService: { analyze: () => ({ categories: [] }) },
    auditService
  });
  const tinyBadBatch = { batchId: 'b1', results: [invalid, invalid] };
  assert.equal(detector.detectFromBatch(tinyBadBatch), null);
});

test('a large batch with a high failure rate and no baseline opens an incident with a likely cause', () => {
  const auditService = new AuditService({ repository: new InMemoryAuditRepository() });
  const failures = Array.from({ length: 8 }, () => invalid);
  const detector = new IncidentDetectorService({
    repository: new InMemoryIncidentRepository(),
    batchService: { list: () => [] },
    failureDnaService: { analyze: () => ({ categories: [{ code: 'MISSING_OR_INVALID_WEIGHT', share: 1 }] }) },
    auditService
  });
  const badBatch = { batchId: 'b2', results: [...failures, routed, routed] };
  const incident = detector.detectFromBatch(badBatch);
  assert.ok(incident);
  assert.match(incident.likelyCause, /missing or invalid weight/);
  assert.equal(detector.list().length, 1);
});

test('incident status transitions are tracked and audited', () => {
  const auditService = new AuditService({ repository: new InMemoryAuditRepository() });
  const detector = new IncidentDetectorService({
    repository: new InMemoryIncidentRepository(),
    batchService: { list: () => [] },
    failureDnaService: { analyze: () => ({ categories: [] }) },
    auditService
  });
  const incident = detector.detectFromBatch({ batchId: 'b3', results: Array.from({ length: 10 }, () => invalid) });
  const updated = detector.transition(incident.incidentId, 'RESOLVED', { actor: 'ops' });
  assert.equal(updated.status, 'RESOLVED');
  assert.ok(auditService.list().some((e) => e.action === 'incident_status_changed'));
});
