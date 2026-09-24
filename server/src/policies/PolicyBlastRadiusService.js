import { NotFoundError } from '../errors/index.js';

/**
 * Calculates the real-world impact of activating a candidate policy by
 * replaying it against every parcel the system has actually processed so
 * far (not a sample) -- see docs/decisions/ADR-005. Read-only: never
 * activates anything and never touches production state.
 */
export class PolicyBlastRadiusService {
  #policyService;
  #batchService;
  #routingEngine;

  constructor({ policyService, batchService, routingEngine }) {
    this.#policyService = policyService;
    this.#batchService = batchService;
    this.#routingEngine = routingEngine;
  }

  analyze(candidateVersion) {
    const current = this.#policyService.getActive();
    const candidate = this.#policyService.get(candidateVersion);
    if (!candidate) throw new NotFoundError('Candidate policy was not found.');

    const parcels = this.#batchService.list().flatMap((batch) => batch.results.map(({ parcel }) => parcel));
    if (!parcels.length) {
      return { currentPolicy: current.version, candidatePolicy: candidate.version, historicalParcels: 0, changed: [], departmentsAffected: 0, newlyPending: 0, newlyReleased: 0, recommendation: 'No historical parcels yet -- process a batch first to see a real blast radius.' };
    }

    const before = this.#routingEngine.routeBatch(parcels, current);
    const after = this.#routingEngine.routeBatch(parcels, candidate);

    const changed = after
      .map((item, index) => ({
        parcelId: item.id,
        from: before[index].outcome.department || before[index].outcome.decision,
        to: item.outcome.department || item.outcome.decision,
        fromStatus: before[index].outcome.status,
        toStatus: item.outcome.status
      }))
      .filter((change) => change.from !== change.to || change.fromStatus !== change.toStatus);

    const departmentsAffected = new Set(changed.flatMap((c) => [c.from, c.to])).size;
    const newlyPending = changed.filter((c) => c.toStatus === 'pending' && c.fromStatus !== 'pending').length;
    const newlyReleased = changed.filter((c) => c.fromStatus === 'pending' && c.toStatus !== 'pending').length;

    return {
      currentPolicy: current.version,
      candidatePolicy: candidate.version,
      historicalParcels: parcels.length,
      changed,
      departmentsAffected,
      newlyPending,
      newlyReleased,
      recommendation: changed.length
        ? `${changed.length} of ${parcels.length} historical parcels (${((changed.length / parcels.length) * 100).toFixed(1)}%) would have been routed differently. Review before activation.`
        : 'No historical parcel would have been routed differently under this candidate.'
    };
  }
}
