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

test('a new operator starts with an empty dashboard even when other operators have processed parcels', async () => {
  const { app } = buildApp();
  const busy = request.agent(app);
  await busy.post('/api/auth/dev-login').send({ email: 'busy-op@example.com', role: 'OPERATOR' });
  await busy.post('/api/batches').send({ parcels: [
    { id: 'S-1', weight: 2, value: 40, destinationCountry: 'NL' },
    { id: 'S-2', weight: 3, value: 1500, destinationCountry: 'DE' },
    { id: 'S-3', weight: -1, value: 10, destinationCountry: 'NL' }
  ], idempotencyKey: 'scope-busy-1' });

  const fresh = request.agent(app);
  await fresh.post('/api/auth/dev-login').send({ email: 'new-op@example.com', role: 'OPERATOR' });

  const dashboard = await fresh.get('/api/dashboard');
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.scope, 'own');
  assert.equal(dashboard.body.snapshot.totalParcels, 0);
  assert.equal(dashboard.body.snapshot.pendingApproval, 0);
  assert.equal(dashboard.body.snapshot.validationErrors, 0);
  assert.deepEqual(dashboard.body.attentionRequired, []);

  const batches = await fresh.get('/api/batches');
  assert.equal(batches.body.total, 0);
  const approvals = await fresh.get('/api/approvals');
  assert.deepEqual(approvals.body, []);
  const parcel = await fresh.get('/api/parcels/S-1');
  assert.equal(parcel.status, 404);

  const own = await busy.get('/api/dashboard');
  assert.equal(own.body.snapshot.totalParcels, 3);
});

test('the dashboard trend is a running total per outcome whose last point matches the snapshot', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'trend-op@example.com', role: 'OPERATOR' });
  await operator.post('/api/batches').send({ parcels: [
    { id: 'T-1', weight: 0.5, value: 20, destinationCountry: 'NL' },
    { id: 'T-2', weight: 3, value: 1500, destinationCountry: 'DE' }
  ], idempotencyKey: 'trend-1' });
  await operator.post('/api/batches').send({ parcels: [
    { id: 'T-3', weight: 20, value: 30, destinationCountry: 'NL' },
    { id: 'T-4', weight: -1, value: 10, destinationCountry: 'NL' }
  ], idempotencyKey: 'trend-2' });

  const { body } = await operator.get('/api/dashboard');
  const { points } = body.trend;
  assert.equal(points.length, 3);
  assert.deepEqual(points[0].values, {});
  const last = points.at(-1).values;
  assert.equal(last.pending, body.snapshot.pendingApproval);
  assert.equal(last.error, body.snapshot.validationErrors);
  for (const [department, count] of Object.entries(body.snapshot.departmentDistribution)) {
    if (department !== 'Insurance Approval') assert.equal(last[department], count);
  }

  const other = request.agent(app);
  await other.post('/api/auth/dev-login').send({ email: 'trend-other@example.com', role: 'OPERATOR' });
  assert.equal((await other.get('/api/dashboard')).body.trend.points.length, 1);
});

test('an operator cannot read or retry another operator\'s batch by ID', async () => {
  const { app } = buildApp();
  const owner = request.agent(app);
  await owner.post('/api/auth/dev-login').send({ email: 'owner-op@example.com', role: 'OPERATOR' });
  const created = await owner.post('/api/batches').send({ parcels: [{ id: 'R-1', weight: -1, value: 10, destinationCountry: 'NL' }], idempotencyKey: 'scope-owner-1' });
  const batchId = created.body.batchId;

  const other = request.agent(app);
  await other.post('/api/auth/dev-login').send({ email: 'other-op@example.com', role: 'OPERATOR' });
  assert.equal((await other.get(`/api/batches/${batchId}`)).status, 404);
  assert.equal((await other.post(`/api/batches/${batchId}/retry`)).status, 404);
  assert.equal((await owner.get(`/api/batches/${batchId}`)).status, 200);
});

test('reviewers and admins still see every operator\'s parcels, so approvals keep working', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'queue-op@example.com', role: 'OPERATOR' });
  await operator.post('/api/batches').send({ parcels: [{ id: 'Q-1', weight: 3, value: 1500, destinationCountry: 'DE' }], idempotencyKey: 'scope-queue-1' });

  const reviewer = request.agent(app);
  await reviewer.post('/api/auth/dev-login').send({ email: 'queue-rev@example.com', role: 'REVIEWER' });
  const dashboard = await reviewer.get('/api/dashboard');
  assert.equal(dashboard.body.scope, 'all');
  assert.equal(dashboard.body.snapshot.totalParcels, 1);
  const approvals = await reviewer.get('/api/approvals');
  assert.equal(approvals.body.length, 1);

  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'queue-admin@example.com', role: 'ADMIN' });
  assert.equal((await admin.get('/api/dashboard')).body.snapshot.totalParcels, 1);
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

test('a container XML upload routes its parcels and marks the inferred country', async () => {
  const { app } = buildApp();
  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'container-op@example.com', role: 'OPERATOR' });
  const content = `<Container><Id>77</Id><parcels>
    <Parcel><Receipient><Address><PostalCode>3036MN</PostalCode></Address></Receipient><Weight>2.0</Weight><Value>0.0</Value></Parcel>
    <Parcel><Receipient><Address><PostalCode>4724BE</PostalCode></Address></Receipient><Weight>100.0</Weight><Value>2000.0</Value></Parcel>
  </parcels></Container>`;
  const res = await operator.post('/api/batches/upload').send({ content, format: 'xml', idempotencyKey: 'container-1' });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.results.map((r) => r.id), ['77-01', '77-02']);
  assert.equal(res.body.results[0].outcome.status, 'routed');
  assert.equal(res.body.results[0].parcel.countrySource, 'postal-code');
  assert.equal(res.body.results[1].outcome.status, 'pending');
});

test('a non-admin only ever sees the active policy; an admin sees the full version history', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'policy-admin@example.com', role: 'ADMIN' });
  await admin.post('/api/policies').send({ version: 'v2', insuranceValueThreshold: 1000, mailWeightLimit: 1, regularWeightLimit: 10, departments: { mail: 'M', regular: 'R', heavy: 'H' } });

  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'policy-op@example.com', role: 'OPERATOR' });
  const asOperator = await operator.get('/api/policies');
  assert.equal(asOperator.body.policies.length, 1);
  assert.equal(asOperator.body.policies[0].version, 'v1');
  assert.equal(asOperator.body.policies[0].state, 'ACTIVE');

  const asAdmin = await admin.get('/api/policies');
  assert.ok(asAdmin.body.policies.length >= 2);
  assert.ok(asAdmin.body.policies.some((p) => p.version === 'v2' && p.state === 'DRAFT'));

  // A non-admin gets a plain 404 for a draft's detail, not 403 -- it doesn't confirm the draft exists.
  const conflicts = await operator.get('/api/policies/v2/conflicts');
  assert.equal(conflicts.status, 404);
  const blastRadius = await operator.get('/api/policies/v2/blast-radius');
  assert.equal(blastRadius.status, 404);
  assert.equal((await admin.get('/api/policies/v2/conflicts')).status, 200);
});

test('activating a second policy over HTTP leaves the first one active too, and both are offered to operators', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'policy-admin2@example.com', role: 'ADMIN' });
  await admin.post('/api/policies').send({ version: 'v2', insuranceValueThreshold: 1000, mailWeightLimit: 1, regularWeightLimit: 10, departments: { mail: 'M', regular: 'R', heavy: 'H' } });
  await admin.post('/api/policies/v2/validate');
  await admin.post('/api/policies/v2/approve');
  await admin.post('/api/policies/v2/activate');

  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'policy-op2@example.com', role: 'OPERATOR' });
  assert.equal((await operator.get('/api/policies/v1/conflicts')).status, 200, 'v1 must still be active and visible -- activating v2 is not a rollback of v1');

  const asOperator = await operator.get('/api/policies');
  assert.deepEqual(asOperator.body.policies.map((p) => p.version).sort(), ['v1', 'v2']);
  assert.deepEqual(asOperator.body.activePolicies.map((p) => p.version).sort(), ['v1', 'v2']);

  await admin.post('/api/policies/v2/rollback');
  assert.equal((await operator.get('/api/policies/v2/conflicts')).status, 404, 'hidden again once rolled back');
  const reactivated = await admin.post('/api/policies/v2/activate');
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.body.state, 'ACTIVE');
  assert.equal((await operator.get('/api/policies/v2/conflicts')).status, 200, 'visible again once reactivated');
});

test('an operator can choose which of several active policies routes a parcel or batch', async () => {
  const { app } = buildApp();
  const admin = request.agent(app);
  await admin.post('/api/auth/dev-login').send({ email: 'policy-admin3@example.com', role: 'ADMIN' });
  await admin.post('/api/policies').send({ version: 'v2', insuranceValueThreshold: 5000, mailWeightLimit: 1, regularWeightLimit: 10, departments: { mail: 'Express Mail', regular: 'Express Regular', heavy: 'Express Heavy' } });
  await admin.post('/api/policies/v2/validate');
  await admin.post('/api/policies/v2/approve');
  await admin.post('/api/policies/v2/activate');

  const operator = request.agent(app);
  await operator.post('/api/auth/dev-login').send({ email: 'policy-op3@example.com', role: 'OPERATOR' });
  const policies = await operator.get('/api/policies');
  assert.deepEqual(policies.body.activePolicies.map((p) => p.version).sort(), ['v1', 'v2']);

  // A €2,000 parcel needs insurance approval under v1 (threshold €1,000) but not under v2 (threshold €5,000).
  const underV1 = await operator.post('/api/parcels/route').send({ parcel: { id: 'CHOOSE-1', weight: 1, value: 2000, destinationCountry: 'NL' }, policyVersion: 'v1' });
  assert.equal(underV1.body.results[0].outcome.status, 'pending');
  const underV2 = await operator.post('/api/parcels/route').send({ parcel: { id: 'CHOOSE-2', weight: 1, value: 2000, destinationCountry: 'NL' }, policyVersion: 'v2' });
  assert.equal(underV2.body.results[0].outcome.status, 'routed');
  assert.equal(underV2.body.results[0].outcome.department, 'Express Mail');

  const batch = await operator.post('/api/batches').send({ parcels: [{ id: 'CHOOSE-3', weight: 1, value: 0, destinationCountry: 'NL' }], idempotencyKey: 'choose-1', policyVersion: 'v2' });
  assert.equal(batch.body.policyVersion, 'v2');

  // A retired version can't be chosen -- rejected up front, not silently routed under it.
  await admin.post('/api/policies/v2/rollback');
  const rejected = await operator.post('/api/parcels/route').send({ parcel: { id: 'CHOOSE-4', weight: 1, value: 0, destinationCountry: 'NL' }, policyVersion: 'v2' });
  assert.equal(rejected.status, 422);
});
