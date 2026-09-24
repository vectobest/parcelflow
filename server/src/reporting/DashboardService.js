/** Read model over BatchService/PolicyService/RiskService/IncidentDetectorService for the operator-facing control room (master prompt section 26) -- a single, focused reporting responsibility. */
export class DashboardService {
  #batchService;
  #policyService;
  #approvalService;
  #riskService;
  #incidentDetectorService;

  constructor({ batchService, policyService, approvalService, riskService, incidentDetectorService }) {
    this.#batchService = batchService;
    this.#policyService = policyService;
    this.#approvalService = approvalService;
    this.#riskService = riskService;
    this.#incidentDetectorService = incidentDetectorService;
  }

  snapshot() {
    const batches = this.#batchService.list();
    const all = batches.flatMap(({ results }) => results);
    const durations = batches.filter((batch) => batch.completedAt).map((batch) => new Date(batch.completedAt) - new Date(batch.createdAt));
    return {
      totalParcels: all.length,
      successful: all.filter(({ outcome }) => outcome.status === 'routed').length,
      validationErrors: all.filter(({ outcome }) => outcome.status === 'error').length,
      pendingApproval: all.filter(({ outcome }) => outcome.status === 'pending').length,
      failed: batches.filter((batch) => ['FAILED', 'PARTIALLY_FAILED'].includes(batch.state)).length,
      retryQueue: batches.filter((batch) => batch.state === 'PARTIALLY_FAILED').length,
      averageProcessingMs: durations.length ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length) : 0,
      departmentDistribution: all.reduce((counts, { outcome }) => {
        if (outcome.department) counts[outcome.department] = (counts[outcome.department] || 0) + 1;
        return counts;
      }, {}),
      activePolicy: this.#policyService.activeVersion()
    };
  }

  /** Everything the Overview page needs in one call: KPIs, health, what needs attention, and open incidents (section 26). */
  overview() {
    const snapshot = this.snapshot();
    const risk = this.#riskService.assess();
    const openIncidents = this.#incidentDetectorService.list().filter((incident) => incident.status !== 'RESOLVED');
    const pendingApprovals = this.#approvalService.list().filter((a) => a.state === 'PENDING_APPROVAL');

    const attention = [];
    if (openIncidents.length) attention.push(`${openIncidents.length} open incident${openIncidents.length === 1 ? '' : 's'} need investigation.`);
    if (pendingApprovals.length > 5) attention.push(`Approval backlog is at ${pendingApprovals.length} parcels.`);
    if (snapshot.retryQueue > 0) attention.push(`${snapshot.retryQueue} batch${snapshot.retryQueue === 1 ? '' : 'es'} partially failed and may need a retry.`);
    if (['HIGH', 'MEDIUM'].includes(risk.level)) attention.push(risk.title);

    const health = openIncidents.some((i) => i.severity === 'CRITICAL') ? 'CRITICAL' : openIncidents.length || risk.level === 'HIGH' ? 'DEGRADED' : 'HEALTHY';

    return { snapshot, risk, health, attentionRequired: attention, openIncidents: openIncidents.length, pendingApprovals: pendingApprovals.length };
  }
}
