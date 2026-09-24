import { RoutingRule } from '../RoutingRule.js';
import { RoutingDecision } from '../../domain/RoutingDecision.js';

/** High-value parcels must clear insurance approval before any department rule applies. */
export class InsuranceApprovalRule extends RoutingRule {
  evaluate(parcel, policy, context = {}) {
    const weight = Number(parcel.weight);
    const value = Number(parcel.value);
    if (value > policy.insuranceValueThreshold && !context.insuranceApproved) {
      return RoutingDecision.pendingApproval({ policy, parcel, weight, value });
    }
    return null;
  }
}
