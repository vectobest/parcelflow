import { Router } from 'express';

/** Append-only audit trail, admin-only (master prompt section 30). */
export class AuditController {
  #auditService;
  #authorizationService;
  constructor({ auditService, authorizationService }) {
    this.#auditService = auditService;
    this.#authorizationService = authorizationService;
  }

  buildRouter() {
    const router = Router();
    router.get('/audit', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'viewAudit');
      res.status(200).json([...this.#auditService.list()].reverse());
    });
    return router;
  }
}
