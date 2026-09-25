import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';

export class ApprovalController {
  #approvalService;
  #readModelsFor;
  constructor({ approvalService, readModelsFor }) {
    this.#approvalService = approvalService;
    this.#readModelsFor = readModelsFor;
  }

  buildRouter() {
    const router = Router();

    router.get('/approvals', (req, res) => res.status(200).json(this.#readModelsFor(req.identity).approvals.list()));

    router.post('/approvals/:id/:action', (req, res, next) => {
      const { action } = req.params;
      if (!['approve', 'reject'].includes(action)) return next(new ValidationError(`Unknown approval action "${action}".`));
      const result = this.#approvalService.decide(req.params.id, { actor: req.identity.actor, role: req.identity.role, name: req.identity.name, decision: action === 'approve' ? 'APPROVED' : 'REJECTED' });
      res.status(200).json(result);
    });

    return router;
  }
}
