import { RoutingRule } from '../RoutingRule.js';
import { RoutingDecision } from '../../domain/RoutingDecision.js';

export class MailWeightRule extends RoutingRule {
  evaluate(parcel, policy) {
    const weight = Number(parcel.weight);
    const value = Number(parcel.value);
    if (weight > policy.mailWeightLimit) return null;
    const department = policy.departments?.mail || 'Mail Department';
    return RoutingDecision.routed({
      policy, parcel, weight, value, department, matchedRule: 'WEIGHT_MAIL',
      reason: `Parcel weight ${weight} kg is at or below ${policy.mailWeightLimit} kg.`
    });
  }
}
