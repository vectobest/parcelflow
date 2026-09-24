import { Config } from './config/Config.js';
import { Logger } from './logging/Logger.js';
import { DEFAULT_POLICY, RoutingEngine } from './routing/RoutingEngine.js';
import { InMemoryPolicyRepository } from './policies/InMemoryPolicyRepository.js';
import { PolicyService } from './policies/PolicyService.js';
import { InMemoryAuditRepository } from './audit/InMemoryAuditRepository.js';
import { AuditService } from './audit/AuditService.js';
import { InMemoryApprovalRepository } from './approvals/InMemoryApprovalRepository.js';
import { ApprovalService } from './approvals/ApprovalService.js';
import { InMemoryBatchRepository } from './batches/InMemoryBatchRepository.js';
import { IdempotencyStore } from './batches/IdempotencyStore.js';
import { BatchService } from './batches/BatchService.js';
import { DecisionComparisonService } from './analysis/DecisionComparisonService.js';
import { DashboardService } from './reporting/DashboardService.js';
import { RiskService } from './intelligence/RiskService.js';
import { AuthenticationService } from './auth/AuthenticationService.js';
import { AuthorizationService } from './auth/AuthorizationService.js';
import { AsyncGate } from './concurrency/AsyncGate.js';

/**
 * The composition root: the one place in the codebase that knows every
 * concrete class and wires them together. Every service above only ever
 * receives its dependencies through its constructor (Dependency Inversion),
 * so this function is also the one place a test needs to touch to replace
 * a real dependency with a fake -- see backend/tests for examples.
 */
export function createContainer({ config = new Config(), clock = () => new Date(), initialPolicy = DEFAULT_POLICY } = {}) {
  const logger = new Logger({ name: 'parcel-routing-system', clock });
  const routingEngine = new RoutingEngine();

  const policyService = new PolicyService({ repository: new InMemoryPolicyRepository(), clock }).bootstrap(initialPolicy);
  const auditService = new AuditService({ repository: new InMemoryAuditRepository(), clock });
  const authorizationService = new AuthorizationService();

  const approvalService = new ApprovalService({
    repository: new InMemoryApprovalRepository(),
    routingEngine,
    policyService,
    auditService,
    authorizationService,
    clock
  });

  const batchService = new BatchService({
    repository: new InMemoryBatchRepository(),
    routingEngine,
    policyService,
    approvalService,
    auditService,
    authorizationService,
    idempotencyStore: new IdempotencyStore(),
    clock,
    maxBatchSize: config.maxBatchSize
  });

  const comparisonService = new DecisionComparisonService({ policyService, batchService, routingEngine });
  const dashboardService = new DashboardService({ batchService, policyService });
  const riskService = new RiskService({ batchService });
  const authenticationService = new AuthenticationService({ mode: config.authMode, tokens: config.authTokens });
  const requestGate = new AsyncGate({ limit: config.apiConcurrency });

  return {
    config,
    logger,
    clock,
    routingEngine,
    policyService,
    auditService,
    authorizationService,
    approvalService,
    batchService,
    comparisonService,
    dashboardService,
    riskService,
    authenticationService,
    requestGate
  };
}
