import test from 'node:test';
import assert from 'node:assert/strict';
import { createContainer } from '../../src/container.js';

test('answers a policy question with real data and cites the version', () => {
  const { operationsAssistantService } = createContainer();
  const answer = operationsAssistantService.ask('which policy is active');
  assert.match(answer.answer, /v1/);
  assert.deepEqual(answer.citedIds, ['v1']);
  assert.equal(answer.unresolved, false);
});

test('answers a batch question by citing the real batch', () => {
  const { batchService, operationsAssistantService } = createContainer();
  const batch = batchService.process([{ id: 'A-1', weight: 2, value: 0, destinationCountry: 'NL' }], { idempotencyKey: 'k' });
  const answer = operationsAssistantService.ask(`batch ${batch.batchId}`);
  assert.equal(answer.unresolved, false);
  assert.ok(answer.citedIds.includes(batch.batchId));
});

test('an unrecognised question is refused, never guessed', () => {
  const { operationsAssistantService } = createContainer();
  const answer = operationsAssistantService.ask('what is the meaning of life');
  assert.equal(answer.unresolved, true);
  assert.match(answer.answer, /don't recognise/);
});

test('a question about an unknown policy version says so instead of hallucinating', () => {
  const { operationsAssistantService } = createContainer();
  const answer = operationsAssistantService.ask('policy v99');
  assert.equal(answer.unresolved, true);
  assert.match(answer.answer, /don't have/);
});
