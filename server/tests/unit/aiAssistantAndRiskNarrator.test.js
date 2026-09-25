import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';
import { AiOperationsAssistantService } from '../../src/assistant/AiOperationsAssistantService.js';
import { AiRiskNarrator } from '../../src/intelligence/AiRiskNarrator.js';

/** A fake GeminiClient that never touches the network, so these tests are fast, deterministic, and need no API key. */
function fakeGemini(script) {
  let call = 0;
  return { generateContent: async (...args) => script[Math.min(call++, script.length - 1)](...args) };
}

const textOnly = (text) => ({ functionCalls: [], text, candidates: [{ content: { role: 'model', parts: [{ text }] } }] });

test('AiOperationsAssistantService calls a tool, feeds the result back, and grounds its final answer in it', async () => {
  const { policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService } = createContainer();

  const gemini = fakeGemini([
    () => ({
      functionCalls: [{ name: 'get_policy', args: { version: 'v1' } }],
      candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'get_policy', args: { version: 'v1' } } }] } }]
    }),
    () => textOnly('Policy v1 is ACTIVE, per the tool result.')
  ]);

  const assistant = new AiOperationsAssistantService({ gemini, policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService, fallback: { ask: () => { throw new Error('fallback should not be used'); } } });
  const answer = await assistant.ask('is v1 active?');

  assert.equal(answer.source, 'gemini');
  assert.equal(answer.answer, 'Policy v1 is ACTIVE, per the tool result.');
  assert.deepEqual(answer.citedIds, ['v1']);
});

test('AiOperationsAssistantService falls back to the deterministic assistant if Gemini never produces text', async () => {
  const { policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService } = createContainer();
  const gemini = fakeGemini([() => ({ functionCalls: [], text: '' })]);
  let fallbackCalled = false;
  const fallback = { ask: (q) => { fallbackCalled = true; return { question: q, answer: 'heuristic answer', citedIds: [], unresolved: false, source: 'heuristic' }; } };

  const assistant = new AiOperationsAssistantService({ gemini, policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService, fallback });
  const answer = await assistant.ask('anything');

  assert.equal(fallbackCalled, true);
  assert.equal(answer.source, 'heuristic');
});

test('AiOperationsAssistantService falls back to the deterministic assistant if Gemini throws', async () => {
  const { policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService } = createContainer();
  const gemini = { generateContent: async () => { throw new Error('network down'); } };
  const fallback = { ask: (q) => ({ question: q, answer: 'heuristic answer', citedIds: [], unresolved: false, source: 'heuristic' }) };

  const assistant = new AiOperationsAssistantService({ gemini, policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService, fallback });
  const answer = await assistant.ask('anything');

  assert.equal(answer.source, 'heuristic');
  assert.equal(answer.answer, 'heuristic answer');
});

test('AiOperationsAssistantService reports an unknown tool call as an error result rather than crashing', async () => {
  const { policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService } = createContainer();
  const gemini = fakeGemini([
    () => ({ functionCalls: [{ name: 'delete_everything', args: {} }], candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'delete_everything', args: {} } }] } }] }),
    () => textOnly('I cannot do that.')
  ]);
  const assistant = new AiOperationsAssistantService({ gemini, policyService, batchService, incidentDetectorService, riskService, failureDnaService, digitalTwinService, fallback: { ask: () => { throw new Error('should not be used'); } } });
  const answer = await assistant.ask('delete everything');
  assert.equal(answer.answer, 'I cannot do that.');
});

test('AiRiskNarrator never overrides the heuristic level, confidence, or evidence -- only the message', async () => {
  const riskService = { assess: () => ({ level: 'MEDIUM', confidence: 68, title: 'x', message: 'original', evidence: ['signal A'], recommendation: 'do X', methodology: 'heuristic' }) };
  const gemini = { generateContent: async () => ({ text: 'A rewritten, friendlier explanation.' }) };
  const narrator = new AiRiskNarrator({ gemini, riskService });
  const result = await narrator.assess();

  assert.equal(result.level, 'MEDIUM');
  assert.equal(result.confidence, 68);
  assert.deepEqual(result.evidence, ['signal A']);
  assert.equal(result.message, 'A rewritten, friendlier explanation.');
  assert.equal(result.source, 'gemini');
});

test('AiRiskNarrator falls back to the heuristic message on any Gemini failure', async () => {
  const riskService = { assess: () => ({ level: 'HIGH', confidence: 82, title: 'x', message: 'original heuristic message', evidence: ['signal A', 'signal B'], recommendation: 'do X' }) };
  const gemini = { generateContent: async () => { throw new Error('quota exceeded'); } };
  const narrator = new AiRiskNarrator({ gemini, riskService });
  const result = await narrator.assess();

  assert.equal(result.message, 'original heuristic message');
  assert.equal(result.source, 'heuristic');
});

test('AiRiskNarrator never calls Gemini when there is insufficient data (nothing to narrate)', async () => {
  const riskService = { assess: () => ({ level: 'INSUFFICIENT_DATA', confidence: 0, title: 'x', message: 'not enough data', evidence: [], recommendation: 'wait' }) };
  let called = false;
  const gemini = { generateContent: async () => { called = true; return { text: 'should not happen' }; } };
  const narrator = new AiRiskNarrator({ gemini, riskService });
  const result = await narrator.assess();

  assert.equal(called, false);
  assert.equal(result.source, 'heuristic');
});

test('AiRiskNarrator reuses a cached narration while the evidence is unchanged, across instances', async () => {
  const riskService = { assess: () => ({ level: 'MEDIUM', confidence: 68, title: 'x', message: 'original', evidence: ['signal A'], recommendation: 'do X' }) };
  let calls = 0;
  const gemini = { generateContent: async () => { calls += 1; return { text: 'Narrated once.' }; } };
  const cache = new Map();
  const first = await new AiRiskNarrator({ gemini, riskService, cache }).assess();
  const second = await new AiRiskNarrator({ gemini, riskService, cache }).assess();

  assert.equal(calls, 1);
  assert.equal(second.message, 'Narrated once.');
  assert.equal(first.source, 'gemini');
  assert.equal(second.source, 'gemini');
});

test('a Gemini quota error falls back with a note that says the usage limit was reached', async () => {
  const { GeminiQuotaError } = await import('../../src/ai/GeminiClient.js');
  const riskService = { assess: () => ({ level: 'HIGH', confidence: 82, title: 'x', message: 'original', evidence: ['signal A'], recommendation: 'do X' }) };
  const gemini = { generateContent: async () => { throw new GeminiQuotaError(Date.now() + 60_000); } };
  const result = await new AiRiskNarrator({ gemini, riskService }).assess();

  assert.equal(result.source, 'heuristic');
  assert.match(result.aiNote, /usage limit/);
});
