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
