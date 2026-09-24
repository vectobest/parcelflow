import { RoutingRule } from '../RoutingRule.js';
import { RoutingDecision } from '../../domain/RoutingDecision.js';

/** Fallback rule: always claims the parcel, so it must stay last in the chain. */
export class HeavyWeightRule extends RoutingRule {
  evaluate(parcel, policy) {
    const weight = Number(parcel.weight);
    const value = Number(parcel.value);
    const department = policy.departments?.heavy || 'Heavy Department';
    return RoutingDecision.routed({
      policy, parcel, weight, value, department, matchedRule: 'WEIGHT_HEAVY',
      reason: `Parcel weight ${weight} kg is above ${policy.regularWeightLimit} kg.`
    });
  }
}
