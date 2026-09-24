import { randomUUID } from 'node:crypto';
import { INCIDENT_STATUSES } from '../domain/Incident.js';
import { NotFoundError, ConflictError } from '../errors/index.js';

const FAILURE_RATE = (results) => (results.length ? results.filter(({ outcome }) => outcome.status === 'error').length / results.length : 0);
const MIN_BATCH_SIZE_FOR_DETECTION = 5;

/**
 * Groups related failures into a single incident instead of raising one
 * alert per failed parcel (master prompt section 19/33: "smart alerting").
 * Called once per processed batch from the batch use-case, not on a
 * timer -- there is no background scheduler in this app, so detection is
 * event-driven off the thing that actually changes state.
 */
export class IncidentDetectorService {
  #repository;
  #batchService;
  #failureDnaService;
  #auditService;
  #clock;

  constructor({ repository, batchService, failureDnaService, auditService, clock = () => new Date() }) {
    this.#repository = repository;
    this.#batchService = batchService;
    this.#failureDnaService = failureDnaService;
    this.#auditService = auditService;
    this.#clock = clock;
  }

  /** Call after a batch finishes processing. Returns the incident it opened, or null if nothing crossed the threshold. */
  detectFromBatch(batch) {
    // A batch this small can swing from 0% to 100% failure on a single bad record --
    // too little evidence to call it an incident (same discipline RiskService applies).
    if (batch.results.length < MIN_BATCH_SIZE_FOR_DETECTION) return null;

    const allBatches = this.#batchService.list();
    const priorBatches = allBatches.filter((b) => b.batchId !== batch.batchId);
    const baseline = priorBatches.length ? priorBatches.reduce((sum, b) => sum + FAILURE_RATE(b.results), 0) / priorBatches.length : 0;
    const current = FAILURE_RATE(batch.results);

    // With no prior batches there is no baseline to compare against, so require a
    // clearly bad rate outright rather than tripping on baseline * 2 + 0.05 == 0.05.
    const crossedThreshold = priorBatches.length === 0 ? current >= 0.3 : current >= 0.15 && current > baseline * 2 + 0.05;
    if (!crossedThreshold) return null;

    // Fold into the most recent open incident instead of spawning a duplicate for the same ongoing spike.
    const recentOpen = this.#repository.list().find((incident) => incident.status !== 'RESOLVED' && Date.now() - new Date(incident.detectedAt).getTime() < 30 * 60 * 1000);
    if (recentOpen) {
      const updated = { ...recentOpen, relatedBatchIds: [...new Set([...recentOpen.relatedBatchIds, batch.batchId])], failureRateAfter: current, evidenceCount: recentOpen.evidenceCount + batch.results.filter(({ outcome }) => outcome.status === 'error').length };
      this.#repository.save(updated);
      return updated;
    }

    const dna = this.#failureDnaService.analyze();
    const dominant = dna.categories[0];

    const incident = {
      incidentId: `INC-${randomUUID().slice(0, 8).toUpperCase()}`,
      detectedAt: this.#clock().toISOString(),
      status: 'NEW',
      severity: current >= 0.4 ? 'CRITICAL' : current >= 0.25 ? 'HIGH' : 'MEDIUM',
      failureRateBefore: baseline,
      failureRateAfter: current,
      relatedBatchIds: [batch.batchId],
      evidenceCount: batch.results.filter(({ outcome }) => outcome.status === 'error').length,
      likelyCause: dominant ? `Likely cause: ${dominant.code.toLowerCase().replaceAll('_', ' ')} (${(dominant.share * 100).toFixed(0)}% of recent failures).` : 'Likely cause: unable to determine a dominant failure category from the evidence so far.',
      recommendedActions: [
        'Quarantine the affected batch and continue processing others normally.',
        'Validate the source feed for the fields flagged in Failure DNA.',
        'Retry the affected records once the upstream issue is fixed.'
      ]
    };
    this.#repository.save(incident);
    this.#auditService.record({ action: 'incident_created', entity: 'incident', entityId: incident.incidentId, actor: 'system', newValue: incident.severity });
    return incident;
  }

  transition(incidentId, status, { actor = 'system' } = {}) {
    if (!INCIDENT_STATUSES.includes(status)) throw new ConflictError(`Unknown incident status "${status}".`);
    const incident = this.#repository.get(incidentId);
    if (!incident) throw new NotFoundError('Incident was not found.');
    const updated = { ...incident, status, [`${status.toLowerCase()}At`]: this.#clock().toISOString() };
    this.#repository.save(updated);
    this.#auditService.record({ action: 'incident_status_changed', entity: 'incident', entityId: incidentId, actor, previousValue: incident.status, newValue: status });
    return updated;
  }

  list() { return this.#repository.list(); }
  get(id) { return this.#repository.get(id); }
}
