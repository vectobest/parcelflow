import { Router } from 'express';
import { ValidationError, NotFoundError } from '../../errors/index.js';
import { POLICY_STATES } from '../../domain/Policy.js';

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

    router.get('/policies', (req, res) => {
      // Only an admin gets to see the rest of the version history (drafts, past approvals, rolled-back
      // versions); everyone else only ever gets to know what's actually live -- the same policy that's
      // already routing their parcels, not one an admin might still be drafting or has since retired.
      const isAdmin = this.#authorizationService.can(req.identity.role, 'managePolicy');
      const policies = isAdmin ? this.#policyService.list() : this.#policyService.list().filter((p) => p.state === POLICY_STATES.ACTIVE);
      // `active` is a single convenience default (the most recently activated policy), kept for any
      // caller that just wants one to route under without asking. `activePolicies` is every version
      // currently live -- more than one can be, by design -- for an operator to choose between.
      res.status(200).json({ active: this.#policyService.getActive(), activePolicies: this.#policyService.listActive(), policies });
    });

    router.post('/policies', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'managePolicy');
      const { policy, validation } = this.#policyService.createDraft(req.body, { actor: req.identity.actor });
      this.#auditService.record({ action: 'policy_created', entity: 'policy', entityId: policy.version, actor: req.identity.actor, correlationId: req.correlationId, newValue: policy.state });
      res.status(201).json({ policy, validation });
    });

    // Same visibility rule as the list above: a non-admin can only look up detail for the active
    // policy, so a 404 (not a 403) is what they get for any other version -- indistinguishable from
    // that version not existing at all, the same convention used for another operator's own data.
    const assertVisible = (req, policy, res, next) => {
      if (!policy) { next(new NotFoundError(`Policy ${req.params.version} was not found.`)); return false; }
      if (policy.state !== POLICY_STATES.ACTIVE && !this.#authorizationService.can(req.identity.role, 'managePolicy')) {
        next(new NotFoundError(`Policy ${req.params.version} was not found.`));
        return false;
      }
      return true;
    };

    router.get('/policies/:version/conflicts', (req, res, next) => {
      const policy = this.#policyService.get(req.params.version);
      if (!assertVisible(req, policy, res, next)) return;
      res.status(200).json(this.#ruleConflictDetector.analyze(policy));
    });

    router.get('/policies/:version/blast-radius', (req, res, next) => {
      const policy = this.#policyService.get(req.params.version);
      if (!assertVisible(req, policy, res, next)) return;
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
