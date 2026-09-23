export const DEFAULT_POLICY = Object.freeze({
  version: 'v1',
  insuranceValueThreshold: 1000,
  mailWeightLimit: 1,
  regularWeightLimit: 10,
  departments: Object.freeze({ mail: 'Mail Department', regular: 'Regular Department', heavy: 'Heavy Department' })
});

function invalidParcel(message, policy, parcelId, evaluatedConditions = {}) {
  return Object.freeze({
    status: 'error',
    decision: 'Rejected',
    department: null,
    parcelId: parcelId || null,
    validation: 'invalid',
    matchedRule: 'VALIDATION_ERROR',
    reason: message,
    evaluatedConditions,
    message,
    policyVersion: policy.version,
    timestamp: new Date().toISOString()
  });
}

export function routeParcel(parcel, policy = DEFAULT_POLICY, { insuranceApproved = false } = {}) {
  const parcelId = parcel?.id || parcel?.parcelId || null;
  if (!parcel || typeof parcel !== 'object') {
    return invalidParcel('Parcel data is required.', policy, parcelId);
  }

  const weight = Number(parcel.weight);
  const value = Number(parcel.value);

  if (!Number.isFinite(weight) || weight < 0) {
    return invalidParcel('Weight must be a non-negative number.', policy, parcelId, { weight });
  }
  if (!Number.isFinite(value) || value < 0) {
    return invalidParcel('Value must be a non-negative number.', policy, parcelId, { weight, value });
  }
  if (typeof parcel.destinationCountry !== 'string' || !parcel.destinationCountry.trim()) {
    return invalidParcel('Destination country is required.', policy, parcelId, { weight, value, destinationCountry: parcel.destinationCountry || null });
  }

  if (value > policy.insuranceValueThreshold && !insuranceApproved) {
    return Object.freeze({
      status: 'pending',
      decision: 'Insurance Approval',
      department: 'Insurance Approval',
      parcelId,
      validation: 'valid',
      matchedRule: 'HIGH_VALUE',
      reason: `Parcel value EUR ${value} exceeds EUR ${policy.insuranceValueThreshold} insurance threshold.`,
      evaluatedConditions: { weight, value, insuranceThreshold: policy.insuranceValueThreshold },
      message: `Value exceeds €${policy.insuranceValueThreshold.toLocaleString('en-US')}; approval is required before routing.`,
      policyVersion: policy.version,
      timestamp: new Date().toISOString()
    });
  }

  const department = weight <= policy.mailWeightLimit
    ? policy.departments?.mail || 'Mail Department'
    : weight <= policy.regularWeightLimit
      ? policy.departments?.regular || 'Regular Department'
      : policy.departments?.heavy || 'Heavy Department';
  const matchedRule = weight <= policy.mailWeightLimit ? 'WEIGHT_MAIL' : weight <= policy.regularWeightLimit ? 'WEIGHT_REGULAR' : 'WEIGHT_HEAVY';
  const reason = matchedRule === 'WEIGHT_MAIL'
    ? `Parcel weight ${weight} kg is at or below ${policy.mailWeightLimit} kg.`
    : matchedRule === 'WEIGHT_REGULAR'
      ? `Parcel weight ${weight} kg is above ${policy.mailWeightLimit} kg and at or below ${policy.regularWeightLimit} kg.`
      : `Parcel weight ${weight} kg is above ${policy.regularWeightLimit} kg.`;

  return Object.freeze({
    status: 'routed',
    decision: department,
    department,
    parcelId,
    validation: 'valid',
    matchedRule,
    reason,
    evaluatedConditions: { weight, value, mailWeightLimit: policy.mailWeightLimit, regularWeightLimit: policy.regularWeightLimit },
    message: `Routed to ${department}.`,
    policyVersion: policy.version,
    timestamp: new Date().toISOString()
  });
}

export function routeBatch(parcels, policy = DEFAULT_POLICY) {
  if (!Array.isArray(parcels)) {
    throw new TypeError('A parcel batch must be an array.');
  }

  return parcels.map((parcel, index) => ({
    id: parcel.id || `parcel-${index + 1}`,
    parcel,
    outcome: routeParcel({ ...parcel, id: parcel.id || `parcel-${index + 1}` }, policy)
  }));
}