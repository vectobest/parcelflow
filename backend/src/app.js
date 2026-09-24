import express from 'express';
import cors from 'cors';
import { securityHeaders } from './http/middleware/security.js';
import { correlationId } from './http/middleware/correlationId.js';
import { requestLogger } from './http/middleware/requestLogger.js';
import { apiRateLimiter } from './http/middleware/rateLimiter.js';
import { errorHandler } from './http/middleware/errorHandler.js';
import { notFoundHandler } from './http/middleware/notFoundHandler.js';
import { buildApiRouter } from './http/routes/apiRoutes.js';
import { mountStatic } from './http/staticRoutes.js';
import { HealthController } from './http/controllers/HealthController.js';
import { DashboardController } from './http/controllers/DashboardController.js';
import { RiskController } from './http/controllers/RiskController.js';
import { PolicyController } from './http/controllers/PolicyController.js';
import { ApprovalController } from './http/controllers/ApprovalController.js';
import { BatchController } from './http/controllers/BatchController.js';
import { ParcelController } from './http/controllers/ParcelController.js';
import { AuditController } from './http/controllers/AuditController.js';

/**
 * Builds the Express application from an already-wired container (see
 * container.js). This function only assembles middleware and routes --
 * it holds no business logic, which is what keeps it easy to read end to
 * end and easy to test with a fresh container per test.
 */
export function createApp(container, { projectRoot, startedAt = Date.now() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders());
  if (container.config.corsOrigin) app.use(cors({ origin: container.config.corsOrigin }));
  app.use(correlationId());
  app.use(requestLogger(container.logger));
  app.use(express.json({ limit: '5mb' }));

  app.use(new HealthController({ policyService: container.policyService, startedAt }).buildRouter());

  const apiRouter = buildApiRouter({
    controllers: [
      new DashboardController({ dashboardService: container.dashboardService }),
      new RiskController({ riskService: container.riskService }),
      new PolicyController({ policyService: container.policyService, auditService: container.auditService }),
      new ApprovalController({ approvalService: container.approvalService }),
      new BatchController({ batchService: container.batchService, comparisonService: container.comparisonService }),
      new ParcelController({ batchService: container.batchService }),
      new AuditController({ auditService: container.auditService })
    ],
    authenticationService: container.authenticationService,
    requestGate: container.requestGate,
    rateLimiter: apiRateLimiter({ windowMs: container.config.rateLimitWindowMs, max: container.config.rateLimitMax })
  });
  app.use('/api', apiRouter);

  if (projectRoot) mountStatic(app, { projectRoot });

  app.use(notFoundHandler('Resource not found.'));
  app.use(errorHandler(container.logger));

  return app;
}
