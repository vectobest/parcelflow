import { ValidationError } from '../errors/index.js';

/**
 * What-if capacity projection (master prompt section 17). This is a
 * transparent linear projection over the system's own observed numbers,
 * not a trained model -- it is labeled as a projection everywhere it is
 * shown, and it never reads or writes production state beyond the
 * dashboard snapshot it starts from.
 */
export class DigitalTwinService {
  #dashboardService;

  constructor({ dashboardService }) {
    this.#dashboardService = dashboardService;
  }

  run({ volumeMultiplier = 1, processingSpeedMultiplier = 1, reviewerCapacityMultiplier = 1, failureRateDelta = 0 } = {}) {
    if (volumeMultiplier <= 0 || processingSpeedMultiplier <= 0 || reviewerCapacityMultiplier <= 0) {
      throw new ValidationError('Simulation multipliers must be greater than zero.');
    }
    const current = this.#dashboardService.snapshot();
    const currentFailureRate = current.totalParcels ? current.validationErrors / current.totalParcels : 0;
    const currentApprovalRate = current.totalParcels ? current.pendingApproval / current.totalParcels : 0;

    const projectedVolume = Math.round(current.totalParcels * volumeMultiplier);
    const projectedFailureRate = Math.max(0, Math.min(1, currentFailureRate + failureRateDelta));
    const projectedApprovals = Math.round(projectedVolume * currentApprovalRate / reviewerCapacityMultiplier);
    const projectedLatencyMs = Math.round((current.averageProcessingMs || 1) * volumeMultiplier / processingSpeedMultiplier);

    return {
      label: 'SIMULATION -- NOT PRODUCTION',
      scenario: { volumeMultiplier, processingSpeedMultiplier, reviewerCapacityMultiplier, failureRateDelta },
      current: { parcels: current.totalParcels, approvals: current.pendingApproval, failureRate: currentFailureRate, averageProcessingMs: current.averageProcessingMs },
      projected: { parcels: projectedVolume, approvals: projectedApprovals, failureRate: projectedFailureRate, averageProcessingMs: projectedLatencyMs },
      methodology: 'Linear projection from the current session\'s observed throughput, failure rate and approval rate. Not a trained model; treat as an order-of-magnitude estimate, not a forecast guarantee.'
    };
  }
}
