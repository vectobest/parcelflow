import { RoutingRule } from '../RoutingRule.js';
import { RoutingDecision } from '../../domain/RoutingDecision.js';

/** Rejects structurally invalid parcels before any business rule runs. Fail closed: never guess a route for bad data. */
export class ValidationRule extends RoutingRule {
  evaluate(parcel, policy) {
    const weight = Number(parcel.weight);
    const value = Number(parcel.value);

    if (!Number.isFinite(weight) || weight < 0) {
      return RoutingDecision.invalid({ policy, parcelId: parcel.id, reason: 'Weight must be a non-negative number.', evaluatedConditions: { weight } });
    }
    if (!Number.isFinite(value) || value < 0) {
      return RoutingDecision.invalid({ policy, parcelId: parcel.id, reason: 'Value must be a non-negative number.', evaluatedConditions: { weight, value } });
    }
    if (typeof parcel.destinationCountry !== 'string' || !parcel.destinationCountry.trim()) {
      return RoutingDecision.invalid({ policy, parcelId: parcel.id, reason: 'Destination country is required.', evaluatedConditions: { weight, value, destinationCountry: parcel.destinationCountry || null } });
    }
    return null;
  }
}
