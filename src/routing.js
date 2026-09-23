export const DEFAULT_POLICY = Object.freeze({
  version: '2026-01-01',
  insuranceValueThreshold: 1000,
  mailWeightLimit: 1,
  regularWeightLimit: 10
});

function invalidParcel(message, policy) {
  return Object.freeze({
    status: 'error',
    department: null,
    message,
    policyVersion: policy.version
  });
}

export function routeParcel(parcel, policy = DEFAULT_POLICY) {
  if (!parcel || typeof parcel !== 'object') {
    return invalidParcel('Parcel data is required.', policy);
  }

  const weight = Number(parcel.weight);
  const value = Number(parcel.value);

  if (!Number.isFinite(weight) || weight < 0) {
    return invalidParcel('Weight must be a non-negative number.', policy);
  }
  if (!Number.isFinite(value) || value < 0) {
    return invalidParcel('Value must be a non-negative number.', policy);
  }
  if (typeof parcel.destinationCountry !== 'string' || !parcel.destinationCountry.trim()) {
    return invalidParcel('Destination country is required.', policy);
  }

  if (value > policy.insuranceValueThreshold) {
    return Object.freeze({
      status: 'pending',
      department: 'Insurance Approval',
      message: `Value exceeds €${policy.insuranceValueThreshold.toLocaleString('en-US')}; approval is required before routing.`,
      policyVersion: policy.version
    });
  }

  const department = weight <= policy.mailWeightLimit
    ? 'Mail Department'
    : weight <= policy.regularWeightLimit
      ? 'Regular Department'
      : 'Heavy Department';

  return Object.freeze({
    status: 'routed',
    department,
    message: `Routed to ${department}.`,
    policyVersion: policy.version
  });
}

export function routeBatch(parcels, policy = DEFAULT_POLICY) {
  if (!Array.isArray(parcels)) {
    throw new TypeError('A parcel batch must be an array.');
  }

  return parcels.map((parcel, index) => ({
    id: parcel.id || `parcel-${index + 1}`,
    parcel,
    outcome: routeParcel(parcel, policy)
  }));
}