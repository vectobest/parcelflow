import { Router } from 'express';
import { AuthorizationError, ValidationError } from '../../errors/index.js';

const MANAGED_ACTIONS = Object.freeze(['approve', 'activate', 'rollback']);

export class PolicyController {
  #policyService;
  #auditService;

  constructor({ policyService, auditService }) {
    this.#policyService = policyService;
    this.#auditService = auditService;
  }

  buildRouter() {
    const router = Router();

    router.get('/policies', (req, res) => {
      res.status(200).json({ active: this.#policyService.getActive(), policies: this.#policyService.list() });
    });

    router.post('/policies', (req, res) => {
      this.#requireRole(req, ['ADMIN'], 'Role is not authorized to create policies.');
      const { policy } = this.#policyService.createDraft(req.body);
      this.#auditService.record('policy_created', policy.version, req.identity.actor, req.correlationId, null, policy.state);
      res.status(201).json(policy);
    });

    router.post('/policies/:version/validate', (req, res) => {
      this.#requireRole(req, ['REVIEWER', 'ADMIN'], 'Role is not authorized to validate policies.');
      const result = this.#policyService.validateAndMark(req.params.version);
      this.#auditService.record('policy_validated', req.params.version, req.identity.actor, req.correlationId, null, result.valid ? 'VALIDATED' : 'INVALID');
      res.status(200).json(result);
    });

    router.post('/policies/:version/:action', (req, res) => {
      const { action } = req.params;
      if (!MANAGED_ACTIONS.includes(action)) throw new ValidationError(`Unknown policy action "${action}".`);
      this.#requireRole(req, ['ADMIN'], 'Role is not authorized to manage policies.');
      const result = this.#policyService[action](req.params.version);
      this.#auditService.record(`policy_${action}`, req.params.version, req.identity.actor, req.correlationId, null, result.state);
      res.status(200).json(result);
    });

    return router;
  }

  #requireRole(req, roles, message) {
    if (!roles.includes(req.identity.role)) throw new AuthorizationError(message);
  }
}
