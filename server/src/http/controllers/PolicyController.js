import { Router } from 'express';
import { ValidationError, NotFoundError } from '../../errors/index.js';

const MANAGED_ACTIONS = Object.freeze(['approve', 'activate', 'rollback']);

/** Policy CRUD plus the full lifecycle (draft -> validate -> approve -> activate -> rollback), rule-conflict detection and blast-radius analysis (master prompt sections 15, 16, 29). */
export class PolicyController {
  #policyService;
  #auditService;
  #authorizationService;
  #ruleConflictDetector;
  #policyBlastRadiusService;

  constructor({ policyService, auditService, authorizationService, ruleConflictDetector, policyBlastRadiusService }) {
    this.#policyService = policyService;
    this.#auditService = auditService;
    this.#authorizationService = authorizationService;
    this.#ruleConflictDetector = ruleConflictDetector;
    this.#policyBlastRadiusService = policyBlastRadiusService;
  }

  buildRouter() {
    const router = Router();

    router.get('/policies', (_req, res) => {
      res.status(200).json({ active: this.#policyService.getActive(), policies: this.#policyService.list() });
    });

    router.post('/policies', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'managePolicy');
      const { policy, validation } = this.#policyService.createDraft(req.body, { actor: req.identity.actor });
      this.#auditService.record({ action: 'policy_created', entity: 'policy', entityId: policy.version, actor: req.identity.actor, correlationId: req.correlationId, newValue: policy.state });
      res.status(201).json({ policy, validation });
    });

    router.get('/policies/:version/conflicts', (req, res, next) => {
      const policy = this.#policyService.get(req.params.version);
      if (!policy) return next(new NotFoundError(`Policy ${req.params.version} was not found.`));
      res.status(200).json(this.#ruleConflictDetector.analyze(policy));
    });

    router.get('/policies/:version/blast-radius', (req, res) => {
      res.status(200).json(this.#policyBlastRadiusService.analyze(req.params.version));
    });

    router.post('/policies/:version/validate', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'managePolicy');
      const result = this.#policyService.validateAndMark(req.params.version);
      this.#auditService.record({ action: 'policy_validated', entity: 'policy', entityId: req.params.version, actor: req.identity.actor, correlationId: req.correlationId, newValue: result.valid ? 'VALIDATED' : 'INVALID' });
      res.status(200).json(result);
    });

    router.post('/policies/:version/:action', (req, res, next) => {
      const { action } = req.params;
      if (!MANAGED_ACTIONS.includes(action)) return next(new ValidationError(`Unknown policy action "${action}".`));
      this.#authorizationService.assertPermission(req.identity.role, 'managePolicy');
      const result = this.#policyService[action](req.params.version);
      this.#auditService.record({ action: `policy_${action}`, entity: 'policy', entityId: req.params.version, actor: req.identity.actor, correlationId: req.correlationId, newValue: result.state });
      res.status(200).json(result);
    });

    return router;
  }
}
