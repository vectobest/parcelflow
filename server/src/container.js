import { Config } from './config/Config.js';
import { Logger } from './logging/Logger.js';
import { DEFAULT_POLICY, RoutingEngine } from './routing/RoutingEngine.js';

import { InMemoryPolicyRepository } from './policies/InMemoryPolicyRepository.js';
import { PolicyService } from './policies/PolicyService.js';
import { RuleConflictDetector } from './policies/RuleConflictDetector.js';
import { PolicyBlastRadiusService } from './policies/PolicyBlastRadiusService.js';

import { InMemoryAuditRepository } from './audit/InMemoryAuditRepository.js';
import { AuditService } from './audit/AuditService.js';

import { InMemoryApprovalRepository } from './approvals/InMemoryApprovalRepository.js';
import { ApprovalService } from './approvals/ApprovalService.js';

import { InMemoryBatchRepository } from './batches/InMemoryBatchRepository.js';
import { IdempotencyStore } from './batches/IdempotencyStore.js';
import { BatchService } from './batches/BatchService.js';
import { SecureBatchParser } from './batches/SecureBatchParser.js';

import { DecisionComparisonService } from './analysis/DecisionComparisonService.js';
import { DashboardService } from './reporting/DashboardService.js';

import { RiskService } from './intelligence/RiskService.js';
import { FailureDnaService } from './intelligence/FailureDnaService.js';
import { InMemoryIncidentRepository } from './intelligence/InMemoryIncidentRepository.js';
import { IncidentDetectorService } from './intelligence/IncidentDetectorService.js';

import { DigitalTwinService } from './simulation/DigitalTwinService.js';
import { RetryService } from './retry/RetryService.js';
import { SystemHistoryService } from './history/SystemHistoryService.js';
import { OperationsAssistantService } from './assistant/OperationsAssistantService.js';
import { AiOperationsAssistantService } from './assistant/AiOperationsAssistantService.js';
import { AiRiskNarrator } from './intelligence/AiRiskNarrator.js';
import { GeminiClient } from './ai/GeminiClient.js';
import { ownApprovals, ownBatches, ownIncidents } from './scoping/ownOperations.js';

import { ChaosDrillService } from './drills/ChaosDrillService.js';
import { SecurityDrillService } from './drills/SecurityDrillService.js';

import { AuthenticationService } from './auth/AuthenticationService.js';
import { AuthorizationService } from './auth/AuthorizationService.js';
import { UserStore } from './auth/UserStore.js';
import { configurePassport } from './auth/passport.js';

import { AsyncGate } from './concurrency/AsyncGate.js';

import { HealthController } from './http/controllers/HealthController.js';
import { AuthController } from './http/controllers/AuthController.js';
import { DashboardController } from './http/controllers/DashboardController.js';
import { ParcelController } from './http/controllers/ParcelController.js';
import { BatchController } from './http/controllers/BatchController.js';
import { ApprovalController } from './http/controllers/ApprovalController.js';
import { PolicyController } from './http/controllers/PolicyController.js';
import { AnalysisController } from './http/controllers/AnalysisController.js';
import { IntelligenceController } from './http/controllers/IntelligenceController.js';
import { SimulationController } from './http/controllers/SimulationController.js';
import { DrillController } from './http/controllers/DrillController.js';
import { HistoryController } from './http/controllers/HistoryController.js';
import { AuditController } from './http/controllers/AuditController.js';

/**
 * The composition root: the one place in the codebase that knows every
 * concrete class and wires them together. Every service above only ever
 * receives its dependencies through its constructor (Dependency
 * Inversion), so this function is also the one place a test needs to
 * touch to replace a real dependency with a fake -- see server/tests.
 */
/**
 * `repositories` lets a caller hand in already-connected, already-hydrated
 * database-backed repositories (see server/src/db/mongoRepositories.js and
 * server.js) in place of any of the in-memory defaults below. Every test in
 * server/tests calls this with no `repositories`, so they are entirely
 * unaffected and keep running against plain in-memory storage.
 */
export function createContainer({ config = new Config(), clock = () => new Date(), initialPolicy = DEFAULT_POLICY, repositories = {} } = {}) {
  const logger = new Logger({ name: 'parcelflow-server', clock });
  const routingEngine = new RoutingEngine();

  const policyService = new PolicyService({ repository: repositories.policyRepository || new InMemoryPolicyRepository(), clock }).bootstrap(initialPolicy);
  const ruleConflictDetector = new RuleConflictDetector();

  const auditService = new AuditService({ repository: repositories.auditRepository || new InMemoryAuditRepository(), clock });
  const authorizationService = new AuthorizationService();
  const authenticationService = new AuthenticationService({ tokens: config.serviceTokens });

  const approvalService = new ApprovalService({ repository: repositories.approvalRepository || new InMemoryApprovalRepository(), routingEngine, policyService, auditService, authorizationService, clock });

  const batchRepository = repositories.batchRepository || new InMemoryBatchRepository();
  const batchService = new BatchService({
    repository: batchRepository, routingEngine, policyService, approvalService, auditService, authorizationService,
    idempotencyStore: new IdempotencyStore(), clock, maxBatchSize: config.maxBatchSize
  });
  const secureBatchParser = new SecureBatchParser({ maxBytes: config.maxUploadBytes, maxRecords: config.maxBatchSize });

  const policyBlastRadiusService = new PolicyBlastRadiusService({ policyService, batchService, routingEngine });
  const incidentDetectorService = new IncidentDetectorService({ repository: repositories.incidentRepository || new InMemoryIncidentRepository(), batchService, failureDnaService: new FailureDnaService({ batchService }), auditService, clock });
  const retryService = new RetryService({ batchRepository, routingEngine, policyService, approvalService, auditService, authorizationService, clock, maxRetries: config.maxRetries });
  const gemini = config.aiEnabled ? new GeminiClient({ apiKey: config.geminiApiKey, model: config.geminiModel }) : null;
  // Shared across every per-viewer read model so identical risk evidence is only ever narrated once.
  const narrationCache = new Map();

  // Every read-side service, built over whichever batches/approvals/incidents the viewer is allowed to see.
  function buildReadModels({ scope, batches, approvals, incidents }) {
    const comparisonService = new DecisionComparisonService({ policyService, batchService: batches, routingEngine });
    const riskService = new RiskService({ batchService: batches, approvalService: approvals });
    const failureDnaService = new FailureDnaService({ batchService: batches });
    const dashboardService = new DashboardService({ batchService: batches, policyService, approvalService: approvals, riskService, incidentDetectorService: incidents });
    const digitalTwinService = new DigitalTwinService({ dashboardService });
    const systemHistoryService = new SystemHistoryService({ policyService, batchService: batches, approvalService: approvals, incidentDetectorService: incidents });
    const heuristicAssistant = new OperationsAssistantService({ policyService, batchService: batches, riskService, incidentDetectorService: incidents, digitalTwinService });
    const operationsAssistantService = gemini
      ? new AiOperationsAssistantService({ gemini, policyService, batchService: batches, incidentDetectorService: incidents, riskService, failureDnaService, digitalTwinService, fallback: heuristicAssistant })
      : heuristicAssistant;
    const riskNarrator = gemini ? new AiRiskNarrator({ gemini, riskService, cache: narrationCache }) : { assess: () => ({ ...riskService.assess(), source: 'heuristic' }) };
    return {
      scope, batches, approvals, incidents,
      comparisonService, riskService, failureDnaService, dashboardService, digitalTwinService,
      systemHistoryService, heuristicAssistant, operationsAssistantService, riskNarrator
    };
  }

  const allOperations = buildReadModels({ scope: 'all', batches: batchService, approvals: approvalService, incidents: incidentDetectorService });

  function readModelsFor(identity) {
    if (authorizationService.can(identity.role, 'viewAllOperations')) return allOperations;
    const batches = ownBatches(batchService, identity.actor);
    return buildReadModels({ scope: 'own', batches, approvals: ownApprovals(approvalService, batches), incidents: ownIncidents(incidentDetectorService, batches) });
  }

  const {
    comparisonService, riskService, failureDnaService, dashboardService, digitalTwinService,
    systemHistoryService, heuristicAssistant, operationsAssistantService, riskNarrator
  } = allOperations;

  const chaosDrillService = new ChaosDrillService({ incidentDetectorService, auditService, clock });
  const securityDrillService = new SecurityDrillService({ authorizationService, authenticationService, auditService, config });

  const userStore = new UserStore({
    adminEmails: config.adminEmails, reviewerEmails: config.reviewerEmails, clock,
    users: repositories.userStoreMaps?.users, pendingRoles: repositories.userStoreMaps?.pendingRoles
  });
  const passport = configurePassport({ config, userStore });

  const requestGate = new AsyncGate({ limit: config.apiConcurrency });

  const healthController = new HealthController({ policyService, config });
  const authController = new AuthController({ passport, config, userStore, authorizationService, auditService });
  const dashboardController = new DashboardController({ readModelsFor });
  const parcelController = new ParcelController({ batchService, readModelsFor });
  const batchController = new BatchController({ batchService, secureBatchParser, incidentDetectorService, retryService, readModelsFor });
  const approvalController = new ApprovalController({ approvalService, readModelsFor });
  const policyController = new PolicyController({ policyService, auditService, authorizationService, ruleConflictDetector, policyBlastRadiusService });
  const analysisController = new AnalysisController({ readModelsFor });
  const intelligenceController = new IntelligenceController({ incidentDetectorService, auditService, readModelsFor });
  const simulationController = new SimulationController({ readModelsFor });
  const drillController = new DrillController({ chaosDrillService, securityDrillService, authorizationService });
  const historyController = new HistoryController({ readModelsFor });
  const auditController = new AuditController({ auditService, authorizationService });

  return {
    config, logger, clock, routingEngine,
    policyService, ruleConflictDetector, policyBlastRadiusService,
    auditService, authorizationService, authenticationService,
    approvalService, batchService, secureBatchParser,
    comparisonService, riskService, failureDnaService, incidentDetectorService,
    dashboardService, digitalTwinService, retryService, systemHistoryService,
    heuristicAssistant, operationsAssistantService, riskNarrator, gemini, readModelsFor,
    chaosDrillService, securityDrillService,
    userStore, passport, requestGate,
    healthController, authController, dashboardController, parcelController, batchController,
    approvalController, policyController, analysisController, intelligenceController,
    simulationController, drillController, historyController, auditController
  };
}
