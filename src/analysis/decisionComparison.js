import { routeBatch } from '../routing.js';

export function createDecisionComparison({ policyStore, batchService }) {
  function simulate(parcels, candidateVersion) {
    const current = policyStore.getActive();
    const candidate = policyStore.get(candidateVersion);
    if (!candidate) throw new Error('Candidate policy was not found.');
    return compare(routeBatch(parcels, current), routeBatch(parcels, candidate), current.version, candidate.version);
  }

  function replay(batchId, policyVersion) {
    const batch = batchService.get(batchId);
    if (!batch) throw new Error('Batch was not found.');
    const parcels = batch.results.map(({ parcel }) => parcel);
    const original = routeBatch(parcels, policyStore.get(batch.policyVersion));
    const policy = policyStore.get(policyVersion) || policyStore.getActive();
    const comparison = compare(original, routeBatch(parcels, policy), batch.policyVersion, policy.version);
    return { batchId, originalPolicy: batch.policyVersion, replayPolicy: policy.version, ...comparison, changed: comparison.changed.length, changes: comparison.changed };
  }

  return { simulate, replay };
}

function compare(before, after, currentPolicy, candidatePolicy) {
  const changes = after.map((item, index) => ({ parcelId: item.id, oldDecision: before[index].outcome.decision, newDecision: item.outcome.decision, oldRule: before[index].outcome.matchedRule, newRule: item.outcome.matchedRule, reason: item.outcome.reason, changed: before[index].outcome.decision !== item.outcome.decision || before[index].outcome.status !== item.outcome.status }));
  return { currentPolicy, candidatePolicy, total: changes.length, unchanged: changes.filter((item) => !item.changed).length, changed: changes.filter((item) => item.changed), newlyPending: changes.filter((item) => item.newDecision === 'Insurance Approval' && item.oldDecision !== item.newDecision).length, before, after };
}