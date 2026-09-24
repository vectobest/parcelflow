import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';

export class ApprovalController {
  #approvalService;
  constructor({ approvalService }) { this.#approvalService = approvalService; }

  buildRouter() {
    const router = Router();

    router.get('/approvals', (_req, res) => res.status(200).json(this.#approvalService.list()));

    router.post('/approvals/:id/:action', (req, res, next) => {
      const { action } = req.params;
      if (!['approve', 'reject'].includes(action)) return next(new ValidationError(`Unknown approval action "${action}".`));
      const result = this.#approvalService.decide(req.params.id, { actor: req.identity.actor, role: req.identity.role, decision: action === 'approve' ? 'APPROVED' : 'REJECTED' });
      res.status(200).json(result);
    });

    return router;
  }
}
