import { Router } from 'express';
import { requireAuth } from '../middleware/identity.js';

/** Composition of every feature router under /api. Everything except /health and /auth/* requires a signed-in identity (RBAC's first gate; fine-grained permission checks happen inside services/controllers). */
export function buildApiRouter(container) {
  const router = Router();

  router.use('/', container.healthController.buildRouter());
  router.use('/', container.authController.buildRouter());

  router.use(requireAuth());
  router.use('/', container.dashboardController.buildRouter());
  router.use('/', container.parcelController.buildRouter());
  router.use('/', container.batchController.buildRouter());
  router.use('/', container.approvalController.buildRouter());
  router.use('/', container.policyController.buildRouter());
  router.use('/', container.analysisController.buildRouter());
  router.use('/', container.intelligenceController.buildRouter());
  router.use('/', container.simulationController.buildRouter());
  router.use('/', container.drillController.buildRouter());
  router.use('/', container.historyController.buildRouter());
  router.use('/', container.auditController.buildRouter());

  return router;
}
