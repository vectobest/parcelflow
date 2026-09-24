/**
 * Deterministic, pattern-matched Operations Assistant: recognises a fixed
 * set of question shapes and answers only from live application data,
 * citing the specific IDs it used. Anything it doesn't recognise gets an
 * honest "I can't answer that" rather than a guess.
 *
 * This is the assistant used directly when GEMINI_API_KEY isn't
 * configured, and it is also the fallback `AiOperationsAssistantService`
 * calls whenever the Gemini-backed path fails to produce a grounded
 * answer -- see docs/decisions/ADR-009. It never talks to a network.
 */
export class OperationsAssistantService {
  #policyService;
  #batchService;
  #riskService;
  #incidentDetectorService;
  #digitalTwinService;

  constructor({ policyService, batchService, riskService, incidentDetectorService, digitalTwinService }) {
    this.#policyService = policyService;
    this.#batchService = batchService;
    this.#riskService = riskService;
    this.#incidentDetectorService = incidentDetectorService;
    this.#digitalTwinService = digitalTwinService;
  }

  ask(question) {
    const q = String(question || '').trim().toLowerCase();
    if (!q) return this.#unknown(question);

    const policyMatch = q.match(/\bpolicy\s+(v[\w.-]+)\b/) || q.match(/\bpolicy\s+version\s+([\w.-]+)\b/);
    if (policyMatch) return this.#answerPolicy(policyMatch[1], question);
    if (/which policy is active|what policy is active|active policy/.test(q)) return this.#answerPolicy(this.#policyService.activeVersion(), question);

    const batchMatch = q.match(/\bbatch\s+([a-f0-9-]{6,})\b/i);
    if (batchMatch) return this.#answerBatch(batchMatch[1], question);

    const incidentMatch = q.match(/\bincident\s+(inc-[a-z0-9]+)\b/i);
    if (incidentMatch) return this.#answerIncident(incidentMatch[1], question);
    if (/last incident|most recent incident|what caused the last incident/.test(q)) return this.#answerLastIncident(question);

    if (/why.*approvals?.*(increas|grow|backlog)|approval.*(increas|grow|backlog)/.test(q)) return this.#answerApprovalTrend(question);
    if (/risk|could go wrong|what might fail/.test(q)) return this.#answerRisk(question);

    const volumeMatch = q.match(/volume increase[sd]?\s+(?:by\s+)?(\d+)\s*%/) || q.match(/(\d+)\s*%\s+more (?:volume|parcels)/);
    if (volumeMatch) return this.#answerVolumeWhatIf(Number(volumeMatch[1]), question);

    return this.#unknown(question);
  }

  #answerPolicy(version, question) {
    const policy = this.#policyService.get(version);
    if (!policy) return { question, answer: `I don't have a policy version "${version}" on record.`, citedIds: [], unresolved: true, source: 'heuristic' };
    return {
      question,
      answer: `Policy ${policy.version} is ${policy.state}. Mail <= ${policy.mailWeightLimit}kg, Regular <= ${policy.regularWeightLimit}kg, Heavy above that. Insurance approval required above EUR ${policy.insuranceValueThreshold}.`,
      citedIds: [policy.version],
      unresolved: false,
      source: 'heuristic'
    };
  }

  #answerBatch(batchId, question) {
    const batch = this.#batchService.list().find((b) => b.batchId.startsWith(batchId));
    if (!batch) return { question, answer: `I don't have a batch matching "${batchId}".`, citedIds: [], unresolved: true, source: 'heuristic' };
    const failed = batch.results.filter((r) => r.outcome.status === 'error').length;
    return {
      question,
      answer: `Batch ${batch.batchId} processed ${batch.results.length} parcels under policy ${batch.policyVersion}: ${batch.results.length - failed} succeeded, ${failed} failed validation. State: ${batch.state}.`,
      citedIds: [batch.batchId, batch.policyVersion],
      unresolved: false,
      source: 'heuristic'
    };
  }

  #answerIncident(incidentId, question) {
    const incident = this.#incidentDetectorService.get(incidentId.toUpperCase());
    if (!incident) return { question, answer: `I don't have an incident matching "${incidentId}".`, citedIds: [], unresolved: true, source: 'heuristic' };
    return { question, answer: `${incident.incidentId} (${incident.severity}, ${incident.status}): failure rate went from ${(incident.failureRateBefore * 100).toFixed(1)}% to ${(incident.failureRateAfter * 100).toFixed(1)}%. ${incident.likelyCause}`, citedIds: [incident.incidentId, ...incident.relatedBatchIds], unresolved: false, source: 'heuristic' };
  }

  #answerLastIncident(question) {
    const incidents = this.#incidentDetectorService.list();
    if (!incidents.length) return { question, answer: 'There have been no incidents detected this session.', citedIds: [], unresolved: false, source: 'heuristic' };
    return this.#answerIncident(incidents.at(-1).incidentId, question);
  }

  #answerApprovalTrend(question) {
    const risk = this.#riskService.assess();
    const evidence = risk.evidence.find((e) => /approval/i.test(e));
    if (!evidence) return { question, answer: 'I don\'t see a rising approval-backlog signal right now. ' + risk.message, citedIds: [], unresolved: false, source: 'heuristic' };
    return { question, answer: evidence, citedIds: [], unresolved: false, source: 'heuristic' };
  }

  #answerRisk(question) {
    const risk = this.#riskService.assess();
    return { question, answer: `${risk.title}: ${risk.message} ${risk.evidence.join(' ')} Recommendation: ${risk.recommendation}`.trim(), citedIds: [], unresolved: risk.level === 'INSUFFICIENT_DATA', source: 'heuristic' };
  }

  #answerVolumeWhatIf(percent, question) {
    const projection = this.#digitalTwinService.run({ volumeMultiplier: 1 + percent / 100 });
    return {
      question,
      answer: `At +${percent}% volume, projected parcels go from ${projection.current.parcels} to ${projection.projected.parcels}, and the approval queue from ${projection.current.approvals} to ${projection.projected.approvals}. ${projection.methodology}`,
      citedIds: [], unresolved: false, source: 'heuristic'
    };
  }

  #unknown(question) {
    return {
      question,
      answer: 'I can only answer from application data, and I don\'t recognise that question yet. Try asking about a specific policy version, a batch ID, an incident ID, the current risk outlook, or "what happens if volume increases 50%".',
      citedIds: [], unresolved: true, source: 'heuristic'
    };
  }
}
