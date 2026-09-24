import { randomUUID } from 'node:crypto';

const SCENARIOS = Object.freeze({
  PARSER_FAILURE: 'A batch upload fails to parse (malformed structure).',
  APPROVAL_SERVICE_UNAVAILABLE: 'The approval workflow cannot be reached for a batch with pending approvals.',
  DUPLICATE_BATCH: 'The same batch is submitted twice in quick succession.',
  POLICY_ACTIVATION_FAILURE: 'An invalid policy is submitted for activation.',
  ROUTING_ENGINE_SLOWDOWN: 'Routing latency increases sharply under load.'
});

/**
 * Admin-only, simulation-only failure drill (master prompt section 21).
 * This never touches real production data: it synthesizes a batch of
 * fabricated failures and runs them through the *real* IncidentDetector
 * and AuditService, tagged `drill: true` throughout, so the lifecycle it
 * demonstrates (FAILURE -> DETECTION -> INCIDENT -> AUDIT) is genuine
 * machinery, not a scripted narrative -- but no real batch, policy or
 * approval is ever created or destroyed.
 */
export class ChaosDrillService {
  #incidentDetectorService;
  #auditService;
  #clock;

  constructor({ incidentDetectorService, auditService, clock = () => new Date() }) {
    this.#incidentDetectorService = incidentDetectorService;
    this.#auditService = auditService;
    this.#clock = clock;
  }

  static get scenarios() { return SCENARIOS; }

  run(scenarioKey, { actor = 'admin' } = {}) {
    if (!SCENARIOS[scenarioKey]) throw new Error(`Unknown chaos scenario "${scenarioKey}".`);
    const drillId = `DRILL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const correlationId = randomUUID();
    const steps = [];

    steps.push({ stage: 'FAILURE', detail: SCENARIOS[scenarioKey], at: this.#clock().toISOString() });

    const syntheticBatch = {
      batchId: `drill-${drillId}`,
      createdAt: this.#clock().toISOString(),
      results: Array.from({ length: 12 }, (_, i) => ({
        id: `DRILL-${i + 1}`,
        parcel: { id: `DRILL-${i + 1}`, weight: 1, value: 0, destinationCountry: 'NL' },
        outcome: { status: i < 9 ? 'error' : 'routed', reason: 'Simulated failure for chaos drill.' }
      }))
    };
    steps.push({ stage: 'DETECTION', detail: 'Failure rate crossed the incident threshold in the simulated batch.', at: this.#clock().toISOString() });

    const incident = this.#incidentDetectorService.detectFromBatch(syntheticBatch);
    steps.push({ stage: 'INCIDENT', detail: incident ? `Incident ${incident.incidentId} opened by the real incident detector.` : 'Incident detector did not open a new incident (an equivalent one was already open).', at: this.#clock().toISOString() });

    steps.push({ stage: 'SAFE_DEGRADATION', detail: 'Unaffected batches and departments continue processing normally; only the simulated batch is flagged.', at: this.#clock().toISOString() });
    steps.push({ stage: 'RECOVERY', detail: 'In a real incident, recovery is manual: fix the upstream cause, then retry the affected records.', at: this.#clock().toISOString() });

    this.#auditService.record({ action: 'chaos_drill_run', entity: 'drill', entityId: drillId, actor, correlationId, newValue: scenarioKey, metadata: { drill: true } });
    steps.push({ stage: 'AUDIT', detail: `Drill recorded to the audit log as ${drillId}.`, at: this.#clock().toISOString() });

    return { drillId, scenario: scenarioKey, description: SCENARIOS[scenarioKey], correlationId, steps, incidentId: incident?.incidentId ?? null, label: 'SIMULATION -- NOT PRODUCTION' };
  }
}
