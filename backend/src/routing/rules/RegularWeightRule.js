import { RoutingRule } from '../RoutingRule.js';
import { RoutingDecision } from '../../domain/RoutingDecision.js';

export class RegularWeightRule extends RoutingRule {
  evaluate(parcel, policy) {
    const weight = Number(parcel.weight);
    const value = Number(parcel.value);
    if (weight > policy.regularWeightLimit) return null;
    const department = policy.departments?.regular || 'Regular Department';
    return RoutingDecision.routed({
      policy, parcel, weight, value, department, matchedRule: 'WEIGHT_REGULAR',
      reason: `Parcel weight ${weight} kg is above ${policy.mailWeightLimit} kg and at or below ${policy.regularWeightLimit} kg.`
    });
  }
}
