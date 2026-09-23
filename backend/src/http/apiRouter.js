import { randomUUID } from 'node:crypto';
import { readJson } from './requestBody.js';
import { sendJson } from './response.js';
import { createAuthenticator } from '../auth/authentication.js';

export function createApiRouter({ operations, authenticator = createAuthenticator(), requestGate }) {
  return async function route(request, response, url, correlationId) {
    if (requestGate) return requestGate.run(() => routeRequest(request, response, url, correlationId));
    return routeRequest(request, response, url, correlationId);
  };

  async function routeRequest(request, response, url, correlationId) {
    const { role, actor } = authenticator.authenticate(request);
    const body = request.method === 'POST' ? await readJson(request) : {};
    if (request.method === 'GET' && url.pathname === '/api/dashboard') return sendJson(response, 200, operations.dashboard(), correlationId);
    if (request.method === 'GET' && url.pathname === '/api/risk') return sendJson(response, 200, operations.risk(), correlationId);
    if (request.method === 'GET' && url.pathname === '/api/policies') return sendJson(response, 200, { active: operations.policyStore.getActive(), policies: operations.policyStore.list() }, correlationId);
    if (request.method === 'GET' && url.pathname === '/api/approvals') return sendJson(response, 200, operations.approvals(), correlationId);
    if (request.method === 'GET' && url.pathname === '/api/audit') {
      if (role !== 'ADMIN') throw new Error('Role is not authorized to view audit logs.');
      return sendJson(response, 200, operations.audit(), correlationId);
    }
    if (request.method === 'POST' && url.pathname === '/api/batches') return sendJson(response, 201, operations.processBatch(body.parcels, { idempotencyKey: body.idempotencyKey, actor, role, correlationId, policyVersion: body.policyVersion }), correlationId);
    if (request.method === 'POST' && url.pathname === '/api/parcels/route') return sendJson(response, 201, operations.processBatch([body.parcel], { idempotencyKey: body.idempotencyKey || randomUUID(), actor, role, correlationId }), correlationId);
    if (request.method === 'POST' && url.pathname === '/api/simulate') return sendJson(response, 200, operations.simulate(body.parcels, body.candidatePolicyVersion), correlationId);
    if (request.method === 'POST' && url.pathname === '/api/replay') return sendJson(response, 200, operations.replay(body.batchId, body.policyVersion), correlationId);
    if (request.method === 'POST' && url.pathname === '/api/retry') return sendJson(response, 200, operations.retryBatch(body.batchId, { actor, role }), correlationId);
    const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
    if (request.method === 'POST' && approvalMatch) return sendJson(response, 200, operations.approveApproval(approvalMatch[1], { actor, role, decision: approvalMatch[2] === 'approve' ? 'APPROVED' : 'REJECTED' }), correlationId);
    const policyMatch = url.pathname.match(/^\/api\/policies\/([^/]+)\/(validate|approve|activate|rollback)$/);
    if (request.method === 'POST' && policyMatch) {
      if (policyMatch[2] === 'validate') {
        if (!['REVIEWER', 'ADMIN'].includes(role)) throw new Error('Role is not authorized to validate policies.');
        const result = operations.policyStore.validateAndMark(policyMatch[1]);
        operations.recordAudit('policy_validated', policyMatch[1], actor, correlationId, null, result.valid ? 'VALIDATED' : 'INVALID');
        return sendJson(response, 200, result, correlationId);
      }
      if (role !== 'ADMIN') throw new Error('Role is not authorized to manage policies.');
      const result = operations.policyStore[policyMatch[2]](policyMatch[1]);
      operations.recordAudit(`policy_${policyMatch[2]}`, policyMatch[1], actor, correlationId, null, result.state);
      return sendJson(response, 200, result, correlationId);
    }
    if (request.method === 'POST' && url.pathname === '/api/policies') {
      if (role !== 'ADMIN') throw new Error('Role is not authorized to create policies.');
      const policy = operations.policyStore.createDraft(body).policy;
      operations.recordAudit('policy_created', policy.version, actor, correlationId, null, policy.state);
      return sendJson(response, 201, policy, correlationId);
    }
    return sendJson(response, 404, { error: 'API route not found.' }, correlationId);
  }
}