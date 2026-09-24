import { Router } from 'express';
import { AuthorizationError } from '../../errors/index.js';

export class AuditController {
  #auditService;
  constructor({ auditService }) { this.#auditService = auditService; }

  buildRouter() {
    const router = Router();
    router.get('/audit', (req, res) => {
      if (req.identity.role !== 'ADMIN') throw new AuthorizationError('Role is not authorized to view audit logs.');
      res.status(200).json(this.#auditService.list());
    });
    return router;
  }
}
