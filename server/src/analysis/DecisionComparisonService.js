import { NotFoundError } from '../errors/index.js';

/** Powers "what-if" policy simulation and historical batch replay, both built on the same RoutingEngine used for live traffic -- so a simulation can never drift from production behaviour. Read-only; never mutates state. */
export class DecisionComparisonService {
  #policyService;
  #batchService;
  #routingEngine;

  constructor({ policyService, batchService, routingEngine }) {
    this.#policyService = policyService;
    this.#batchService = batchService;
    this.#routingEngine = routingEngine;
  }

  simulate(parcels, candidateVersion) {
    const current = this.#policyService.getActive();
    const candidate = this.#policyService.get(candidateVersion);
    if (!candidate) throw new NotFoundError('Candidate policy was not found.');
    return this.#compare(
      this.#routingEngine.routeBatch(parcels, current),
      this.#routingEngine.routeBatch(parcels, candidate),
      current.version,
      candidate.version
    );
  }

  replay(batchId, policyVersion) {
    const batch = this.#batchService.get(batchId);
    if (!batch) throw new NotFoundError('Batch was not found.');
    const parcels = batch.results.map(({ parcel }) => parcel);
    const original = this.#routingEngine.routeBatch(parcels, this.#policyService.get(batch.policyVersion));
    const policy = this.#policyService.get(policyVersion) || this.#policyService.getActive();
    const comparison = this.#compare(original, this.#routingEngine.routeBatch(parcels, policy), batch.policyVersion, policy.version);
    return { batchId, originalPolicy: batch.policyVersion, replayPolicy: policy.version, ...comparison, changed: comparison.changed.length, changes: comparison.changed };
  }

  #compare(before, after, currentPolicy, candidatePolicy) {
    const changes = after.map((item, index) => ({
      parcelId: item.id,
      oldDecision: before[index].outcome.decision,
      newDecision: item.outcome.decision,
      oldRule: before[index].outcome.matchedRule,
      newRule: item.outcome.matchedRule,
      reason: item.outcome.reason,
      changed: before[index].outcome.decision !== item.outcome.decision || before[index].outcome.status !== item.outcome.status
    }));
    return {
      currentPolicy,
      candidatePolicy,
      total: changes.length,
      unchanged: changes.filter((change) => !change.changed).length,
      changed: changes.filter((change) => change.changed),
      newlyPending: changes.filter((change) => change.newDecision === 'Insurance Approval' && change.oldDecision !== change.newDecision).length,
      before,
      after
    };
  }
}
