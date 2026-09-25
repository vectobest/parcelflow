import { aiFallbackNote } from '../intelligence/AiRiskNarrator.js';
import { FunctionCallingConfigMode } from '@google/genai';

const TOOLS = [
  {
    name: 'get_policy',
    description: 'Get a routing policy by version. Omit "version" to get the currently active policy.',
    parametersJsonSchema: { type: 'object', properties: { version: { type: 'string', description: 'Policy version, e.g. "v1".' } } }
  },
  {
    name: 'get_batch',
    description: 'Get a processed parcel batch by its ID (a full ID or a short prefix).',
    parametersJsonSchema: { type: 'object', properties: { batchId: { type: 'string' } }, required: ['batchId'] }
  },
  {
    name: 'list_recent_batches',
    description: 'List the most recently processed batches, newest first.',
    parametersJsonSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max batches to return, default 10.' } } }
  },
  {
    name: 'get_incident',
    description: 'Get an incident by its ID, e.g. "INC-AB12CD34".',
    parametersJsonSchema: { type: 'object', properties: { incidentId: { type: 'string' } }, required: ['incidentId'] }
  },
  {
    name: 'list_incidents',
    description: 'List every incident detected this session.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'assess_risk',
    description: 'Get the current operational risk assessment (heuristic, over recent batches and the approval queue).',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_failure_dna',
    description: 'Get the current validation-failure fingerprint breakdown and trend.',
    parametersJsonSchema: { type: 'object', properties: {} }
  },
  {
    name: 'run_digital_twin',
    description: 'Run a what-if capacity projection. All fields optional multipliers around 1.0 (e.g. 1.5 = +50%); omit any you are not asked about.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        volumeMultiplier: { type: 'number' },
        processingSpeedMultiplier: { type: 'number' },
        reviewerCapacityMultiplier: { type: 'number' },
        failureRateDelta: { type: 'number' }
      }
    }
  }
];

const SYSTEM_INSTRUCTION = `You are the ParcelFlow Operations Assistant, embedded in a parcel routing control room.

Rules you must never break:
- You may only state facts returned by a tool call in this conversation. Never invent a policy version, batch ID, incident ID, or number.
- If the available tools cannot answer the question, say so plainly instead of guessing.
- Always cite the specific IDs (policy version, batch ID, incident ID) you used, by name, in your answer.
- You cannot take any action -- you cannot approve anything, activate a policy, or change a role. You can only explain, summarize, and help investigate.
- All monetary values returned by tools are in EUR. Always write them as "EUR <amount>" (e.g. "EUR 1,000"), never with a "$" sign.
- Keep answers concise: 2-4 sentences unless the question genuinely needs a list.`;

/**
 * Gemini-backed assistant using manual function calling: the model can
 * only see data it explicitly requested through one of the tools above,
 * each of which is a thin, read-only wrapper over a real application
 * service. If the model ever fails to ground an answer in a tool result
 * (bad response, network error, no API key reachable, empty answer), this
 * falls back to the deterministic pattern-matched assistant rather than
 * ever returning an ungrounded guess -- see docs/decisions/ADR-009.
 */
export class AiOperationsAssistantService {
  #gemini;
  #policyService;
  #batchService;
  #incidentDetectorService;
  #riskService;
  #failureDnaService;
  #digitalTwinService;
  #fallback;

  constructor({ gemini, policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService, fallback }) {
    this.#gemini = gemini;
    this.#policyService = policyService;
    this.#batchService = batchService;
    this.#incidentDetectorService = incidentDetectorService;
    this.#riskService = riskService;
    this.#failureDnaService = failureDnaService;
    this.#digitalTwinService = digitalTwinService;
    this.#fallback = fallback;
  }

  async ask(question) {
    try {
      const citedIds = new Set();
      const contents = [{ role: 'user', parts: [{ text: question }] }];
      const tools = [{ functionDeclarations: TOOLS }];
      const toolConfig = { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } };

      let response;
      for (let turn = 0; turn < 4; turn += 1) {
        response = await this.#gemini.generateContent({ contents, systemInstruction: SYSTEM_INSTRUCTION, tools, toolConfig });
        const calls = response.functionCalls;
        if (!calls || calls.length === 0) break;

        contents.push(response.candidates?.[0]?.content || { role: 'model', parts: calls.map((c) => ({ functionCall: c })) });
        const responseParts = calls.map((call) => ({
          functionResponse: { name: call.name, response: { result: this.#executeTool(call.name, call.args || {}, citedIds) } }
        }));
        contents.push({ role: 'user', parts: responseParts });
      }

      const answer = response?.text?.trim();
      if (!answer) return this.#fallback.ask(question);
      return { question, answer, citedIds: [...citedIds], unresolved: false, source: 'gemini' };
    } catch (error) {
      return { ...this.#fallback.ask(question), aiNote: aiFallbackNote(error) };
    }
  }

  #executeTool(name, args, citedIds) {
    try {
      switch (name) {
        case 'get_policy': {
          const policy = this.#policyService.get(args.version);
          if (!policy) return { error: `No policy found for version "${args.version || '(active)'}".` };
          citedIds.add(policy.version);
          return policy;
        }
        case 'get_batch': {
          const batch = this.#batchService.list().find((b) => b.batchId.startsWith(args.batchId));
          if (!batch) return { error: `No batch found matching "${args.batchId}".` };
          citedIds.add(batch.batchId);
          return {
            batchId: batch.batchId, policyVersion: batch.policyVersion, state: batch.state,
            totalParcels: batch.results.length,
            failed: batch.results.filter((r) => r.outcome.status === 'error').length,
            pending: batch.results.filter((r) => r.outcome.status === 'pending').length
          };
        }
        case 'list_recent_batches': {
          const batches = [...this.#batchService.list()].reverse().slice(0, args.limit || 10);
          batches.forEach((b) => citedIds.add(b.batchId));
          return batches.map((b) => ({ batchId: b.batchId, policyVersion: b.policyVersion, state: b.state, totalParcels: b.results.length }));
        }
        case 'get_incident': {
          const incident = this.#incidentDetectorService.get(String(args.incidentId || '').toUpperCase());
          if (!incident) return { error: `No incident found matching "${args.incidentId}".` };
          citedIds.add(incident.incidentId);
          return incident;
        }
        case 'list_incidents': {
          const incidents = this.#incidentDetectorService.list();
          incidents.forEach((i) => citedIds.add(i.incidentId));
          return incidents;
        }
        case 'assess_risk':
          return this.#riskService.assess();
        case 'get_failure_dna':
          return this.#failureDnaService.analyze();
        case 'run_digital_twin':
          return this.#digitalTwinService.run(args);
        default:
          return { error: `Unknown tool "${name}".` };
      }
    } catch (error) {
      return { error: error.message };
    }
  }
}
