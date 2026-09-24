import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';

const DECISIONS = Object.freeze({ approve: 'APPROVED', reject: 'REJECTED' });

export class ApprovalController {
  #approvalService;
  constructor({ approvalService }) { this.#approvalService = approvalService; }

  buildRouter() {
    const router = Router();

    router.get('/approvals', (req, res) => res.status(200).json(this.#approvalService.list()));

    router.post('/approvals/:id/:decision', (req, res) => {
      const decision = DECISIONS[req.params.decision];
      if (!decision) throw new ValidationError(`Unknown approval decision "${req.params.decision}".`);
      const result = this.#approvalService.decide(req.params.id, { actor: req.identity.actor, role: req.identity.role, decision });
      res.status(200).json(result);
    });

    return router;
  }
}
