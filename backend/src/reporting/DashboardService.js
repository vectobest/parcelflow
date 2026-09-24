/** Read model over BatchService/PolicyService for the operator-facing control room -- a single, focused reporting responsibility. */
export class DashboardService {
  #batchService;
  #policyService;

  constructor({ batchService, policyService }) {
    this.#batchService = batchService;
    this.#policyService = policyService;
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
      failed: batches.filter(({ state }) => ['FAILED', 'PARTIALLY_FAILED'].includes(state)).length,
      retryQueue: batches.filter(({ state }) => state === 'PARTIALLY_FAILED').length,
      averageProcessingMs: durations.length ? Math.round(durations.reduce((total, duration) => total + duration, 0) / durations.length) : 0,
      departmentDistribution: all.reduce((counts, { outcome }) => {
        if (outcome.department) counts[outcome.department] = (counts[outcome.department] || 0) + 1;
        return counts;
      }, {}),
      activePolicy: this.#policyService.activeVersion()
    };
  }
}
