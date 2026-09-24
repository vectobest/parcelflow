/**
 * RoutingDecision is an immutable value object describing the outcome of
 * routing a single parcel. Freezing it prevents any downstream code from
 * mutating a decision after the fact, which matters for audit integrity
 * and for decision replay staying honest.
 */
export class RoutingDecision {
  constructor(props) {
    Object.assign(this, props);
    Object.freeze(this);
  }

  static invalid({ policy, parcelId, reason, evaluatedConditions = {} }) {
    return new RoutingDecision({
      status: 'error',
      decision: 'Rejected',
      department: null,
      parcelId: parcelId || null,
      validation: 'invalid',
      matchedRule: 'VALIDATION_ERROR',
      reason,
      evaluatedConditions,
      message: reason,
      policyVersion: policy?.version ?? null,
      timestamp: new Date().toISOString()
    });
  }

  static pendingApproval({ policy, parcel, weight, value }) {
    const reason = `Parcel value EUR ${value} exceeds EUR ${policy.insuranceValueThreshold} insurance threshold.`;
    return new RoutingDecision({
      status: 'pending',
      decision: 'Insurance Approval',
      department: 'Insurance Approval',
      parcelId: parcel.id,
      validation: 'valid',
      matchedRule: 'HIGH_VALUE',
      reason,
      evaluatedConditions: { weight, value, insuranceThreshold: policy.insuranceValueThreshold },
      message: `Value exceeds EUR ${policy.insuranceValueThreshold.toLocaleString('en-US')}; approval is required before routing.`,
      policyVersion: policy.version,
      timestamp: new Date().toISOString()
    });
  }

  static routed({ policy, parcel, weight, value, department, matchedRule, reason }) {
    return new RoutingDecision({
      status: 'routed',
      decision: department,
      department,
      parcelId: parcel.id,
      validation: 'valid',
      matchedRule,
      reason,
      evaluatedConditions: { weight, value, mailWeightLimit: policy.mailWeightLimit, regularWeightLimit: policy.regularWeightLimit },
      message: `Routed to ${department}.`,
      policyVersion: policy.version,
      timestamp: new Date().toISOString()
    });
  }

  static rejected({ policy, parcel, reason }) {
    return new RoutingDecision({
      status: 'rejected',
      decision: 'Rejected',
      department: null,
      parcelId: parcel.id,
      validation: 'valid',
      matchedRule: 'INSURANCE_REJECTED',
      reason,
      evaluatedConditions: {},
      message: reason,
      policyVersion: policy.version,
      timestamp: new Date().toISOString()
    });
  }
}
