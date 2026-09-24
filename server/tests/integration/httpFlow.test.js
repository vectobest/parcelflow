import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { Config } from '../../src/config/Config.js';
import { createContainer } from '../../src/container.js';
import { createApp } from '../../src/app.js';

function buildApp(envOverrides = {}) {
  const config = new Config({ ...process.env, CLIENT_ORIGIN: 'http://localhost:5173', ...envOverrides });
  const container = createContainer({ config });
  return { app: createApp(container), container };
}

test('GET /api/health is public and returns 200', async () => {
  const { app } = buildApp();
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('protected routes reject an anonymous caller with 401', async () => {
  const { app } = buildApp();
  const res = await request(app).get('/api/dashboard');
  assert.equal(res.status, 401);
});

test('dev-login signs in, and the session authenticates subsequent requests', async () => {
  const { app } = buildApp();
  const agent = request.agent(app);
  const login = await agent.post('/api/auth/dev-login').send({ email: 'op@example.com', role: 'OPERATOR' });
  assert.equal(login.status, 200);
  const dashboard = await agent.get('/api/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.snapshot.totalParcels, 0);
});

test('dev-login is disabled once Google OAuth is configured (no backdoor on a real deployment)', async () => {
  const { app } = buildApp({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' });
  const res = await request(app).post('/api/auth/dev-login').send({ email: 'anyone@example.com', role: 'ADMIN' });
  assert.equal(res.status, 422);
});

test('an OPERATOR can process a batch but a REVIEWER is required to approve', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'op2@example.com', role: 'OPERATOR' });

  const batchRes = await operator.post('/api/batches').send({ parcels: [{ id: 'H-1', weight: 3, value: 1250, destinationCountry: 'NL' }], idempotencyKey: 'http-1' });
  assert.equal(batchRes.status, 201);
  const approvalId = batchRes.body.approvalRecords[0];

  const deniedApproval = await operator.post(`/api/approvals/${approvalId}/approve`);
  assert.equal(deniedApproval.status, 403);

  const reviewer = request.agent(app);
  await reviewer.post('/api/auth/dev-login').send({ email: 'rev@example.com', role: 'REVIEWER' });
  const approved = await reviewer.post(`/api/approvals/${approvalId}/approve`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.outcome.status, 'routed');
});

test('the audit log is admin-only', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'op3@example.com', role: 'OPERATOR' });
  const denied = await operator.get('/api/audit');
  assert.equal(denied.status, 403);

  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin2@example.com', role: 'ADMIN' });
  const allowed = await admin.get('/api/audit');
  assert.equal(allowed.status, 200);
  assert.ok(Array.isArray(allowed.body));
});

test('an oversized upload is rejected by the secure batch upload endpoint', async () => {
  const { app } = buildApp({ MAX_UPLOAD_BYTES: '100' });
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin3@example.com', role: 'ADMIN' });
  const res = await admin.post('/api/batches/upload').send({ content: JSON.stringify({ parcels: [{ id: 'X', weight: 1, value: 0, destinationCountry: 'NL' }].concat(Array(50).fill({ id: 'X', weight: 1, value: 0, destinationCountry: 'NL' })) }), format: 'json', idempotencyKey: 'oversized' });
  assert.equal(res.status, 422);
});

test('a malformed XML upload with a DOCTYPE is rejected, not parsed', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin4@example.com', role: 'ADMIN' });
  const res = await admin.post('/api/batches/upload').send({ content: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Batch/>', format: 'xml', idempotencyKey: 'xxe-1' });
  assert.equal(res.status, 422);
});

test('GET /api/risk and POST /api/assistant/ask work over HTTP on the heuristic path (no GEMINI_API_KEY in the test environment)', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin5@example.com', role: 'ADMIN' });

  const risk = await admin.get('/api/risk');
  assert.equal(risk.status, 200);
  assert.equal(risk.body.source, 'heuristic');

  const answer = await admin.post('/api/assistant/ask').send({ question: 'which policy is active' });
  assert.equal(answer.status, 200);
  assert.equal(answer.body.source, 'heuristic');
  assert.match(answer.body.answer, /v1/);
});

test('an admin can pre-assign a role to an email that has not signed in yet, and it applies on first sign-in', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin6@example.com', role: 'ADMIN' });

  const preset = await admin.post('/api/auth/pending-roles').send({ email: 'future@example.com', role: 'REVIEWER' });
  assert.equal(preset.status, 200);
  assert.equal(preset.body.role, 'REVIEWER');

  const pending = await admin.get('/api/auth/pending-roles');
  assert.equal(pending.status, 200);
  assert.ok(pending.body.some((p) => p.email === 'future@example.com' && p.role === 'REVIEWER'));

  const newUser = request.agent(app);
  const login = await newUser.post('/api/auth/dev-login').send({ email: 'future@example.com' });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, 'REVIEWER');

  const pendingAfter = await admin.get('/api/auth/pending-roles');
  assert.ok(!pendingAfter.body.some((p) => p.email === 'future@example.com'));
});

test('pre-assigning a role is admin-only and rejects an already-signed-in email', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'op7@example.com', role: 'OPERATOR' });
  const denied = await operator.post('/api/auth/pending-roles').send({ email: 'someone@example.com', role: 'ADMIN' });
  assert.equal(denied.status, 403);

  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'admin7@example.com', role: 'ADMIN' });
  const rejected = await admin.post('/api/auth/pending-roles').send({ email: 'op7@example.com', role: 'ADMIN' });
  assert.equal(rejected.status, 422);
});
