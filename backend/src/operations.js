import { DEFAULT_POLICY } from './routing.js';
import { createPolicyStore } from './policy.js';
import { createAuditLog } from './audit/auditLog.js';
import { createApprovalService } from './approvals/approvalService.js';
import { createBatchService } from './batches/batchService.js';
import { createDecisionComparison } from './analysis/decisionComparison.js';
import { createDashboardService } from './reporting/dashboardService.js';
import { createRiskService } from './intelligence/riskService.js';

export function createOperations({ clock = () => new Date(), initialPolicy = DEFAULT_POLICY } = {}) {
  const policyStore = createPolicyStore(initialPolicy);
  const auditLog = createAuditLog({ clock });
  const approvalService = createApprovalService({ clock, policyStore, auditLog });
  const batchService = createBatchService({ clock, policyStore, approvalService, auditLog });
  const comparison = createDecisionComparison({ policyStore, batchService });
  const dashboard = createDashboardService({ batchService, policyStore });
  const risk = createRiskService({ batchService });

  return {
    policyStore,
    processBatch: batchService.process,
    getBatch: batchService.get,
    approvals: approvalService.list,
    approveApproval: approvalService.decide,
    simulate: comparison.simulate,
    replay: comparison.replay,
    retryBatch: batchService.retry,
    dashboard: dashboard.snapshot,
    risk: risk.assess,
    audit: auditLog.list,
    recordAudit: auditLog.record
  };
}
