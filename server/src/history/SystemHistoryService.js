/**
 * "Time Machine" (master prompt section 23): reconstructs system state at
 * an arbitrary past timestamp from data the app already recorded (policy
 * transition timestamps, batch timestamps, incident timestamps) rather
 * than a separate periodic-snapshot store. Read-only, always derived, so
 * it can never drift from what actually happened.
 */
export class SystemHistoryService {
  #policyService;
  #batchService;
  #approvalService;
  #incidentDetectorService;

  constructor({ policyService, batchService, approvalService, incidentDetectorService }) {
    this.#policyService = policyService;
    this.#batchService = batchService;
    this.#approvalService = approvalService;
    this.#incidentDetectorService = incidentDetectorService;
  }

  timeline() {
    const events = [];
    for (const policy of this.#policyService.list()) {
      if (policy.activatedAt) events.push({ at: policy.activatedAt, type: 'POLICY_ACTIVATED', label: `Policy ${policy.version} activated` });
      if (policy.rolledBackAt) events.push({ at: policy.rolledBackAt, type: 'POLICY_ROLLED_BACK', label: `Policy ${policy.version} rolled back` });
    }
    for (const batch of this.#batchService.list()) {
      events.push({ at: batch.createdAt, type: 'BATCH_PROCESSED', label: `Batch ${batch.batchId.slice(0, 8)} processed (${batch.results.length} parcels)`, refId: batch.batchId });
    }
    for (const incident of this.#incidentDetectorService.list()) {
      events.push({ at: incident.detectedAt, type: 'INCIDENT_DETECTED', label: `Incident ${incident.incidentId} detected`, refId: incident.incidentId });
    }
    return events.filter((e) => e.at).sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  stateAt(isoTimestamp) {
    const t = new Date(isoTimestamp).getTime();
    if (Number.isNaN(t)) throw new RangeError('A valid ISO timestamp is required.');

    const activePolicyAt = [...this.#policyService.list()]
      .filter((p) => p.activatedAt && new Date(p.activatedAt).getTime() <= t && !(p.rolledBackAt && new Date(p.rolledBackAt).getTime() <= t))
      .sort((a, b) => new Date(b.activatedAt) - new Date(a.activatedAt))[0];

    const batchesAt = this.#batchService.list().filter((b) => new Date(b.createdAt).getTime() <= t);
    const parcelsAt = batchesAt.flatMap((b) => b.results);
    const failureRate = parcelsAt.length ? parcelsAt.filter(({ outcome }) => outcome.status === 'error').length / parcelsAt.length : 0;

    const queueSizeAt = this.#approvalService.list().filter((a) => new Date(a.createdAt).getTime() <= t && !(a.decidedAt && new Date(a.decidedAt).getTime() <= t)).length;

    const openIncidentsAt = this.#incidentDetectorService.list().filter((i) => new Date(i.detectedAt).getTime() <= t && !(i.resolvedAt && new Date(i.resolvedAt).getTime() <= t));

    return {
      at: isoTimestamp,
      activePolicy: activePolicyAt?.version ?? null,
      parcelsProcessed: parcelsAt.length,
      failureRate,
      approvalQueueSize: queueSizeAt,
      openIncidents: openIncidentsAt.map((i) => i.incidentId)
    };
  }
}
