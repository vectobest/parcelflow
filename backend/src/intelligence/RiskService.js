/** Lightweight trend analysis over recent batches -- deliberately reports INSUFFICIENT_DATA rather than inventing a prediction from too little history. */
export class RiskService {
  #batchService;

  constructor({ batchService }) {
    this.#batchService = batchService;
  }

  assess() {
    const batches = this.#batchService.list();
    if (batches.length < 2) {
      return { level: 'INSUFFICIENT_DATA', confidence: 0, title: 'Not enough history yet', message: 'Process at least two batches before operational trends are assessed.', evidence: [], recommendation: 'Continue normal processing and review this panel after more batches.' };
    }

    const recent = batches.slice(-5);
    const failureRates = recent.map(({ results }) => {
      const failures = results.filter(({ outcome }) => outcome.status === 'error').length;
      return results.length ? failures / results.length : 0;
    });
    const approvalBacklog = recent.at(-1).results.filter(({ outcome }) => outcome.status === 'pending').length;
    const priorApprovalBacklog = recent.length > 1 ? recent.at(-2).results.filter(({ outcome }) => outcome.status === 'pending').length : approvalBacklog;
    const risingFailures = failureRates.at(-1) > 0 && failureRates.at(-1) > failureRates[0];
    const risingApprovalBacklog = approvalBacklog > priorApprovalBacklog;

    const evidence = [];
    if (risingFailures) evidence.push(`Validation failures increased from ${(failureRates[0] * 100).toFixed(1)}% to ${(failureRates.at(-1) * 100).toFixed(1)}% across the observed batches.`);
    if (risingApprovalBacklog) evidence.push(`Pending approvals increased from ${priorApprovalBacklog} to ${approvalBacklog}.`);
    if (!evidence.length) return { level: 'LOW', confidence: 78, title: 'No emerging operational risk', message: 'Recent batches are within the observed operating pattern.', evidence: ['No rising validation-failure trend detected.', 'No rising approval backlog detected.'], recommendation: 'Continue monitoring normal operations.' };

    const level = risingFailures && risingApprovalBacklog ? 'HIGH' : 'MEDIUM';
    return {
      level,
      confidence: level === 'HIGH' ? 82 : 68,
      title: level === 'HIGH' ? 'Multiple signals need attention' : 'Operational trend needs attention',
      message: risingFailures ? 'Validation quality is declining across recent batches.' : 'The approval queue is growing across recent batches.',
      evidence,
      recommendation: risingFailures ? 'Check the upstream parcel feed for missing or invalid destination data.' : 'Assign reviewer capacity before the approval queue grows further.'
    };
  }
}
