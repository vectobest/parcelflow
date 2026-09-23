export const POLICY_STATES = Object.freeze({ DRAFT: 'DRAFT', VALIDATED: 'VALIDATED', APPROVED: 'APPROVED', ACTIVE: 'ACTIVE', ROLLED_BACK: 'ROLLED_BACK' });

function copyPolicy(policy) {
  return {
    ...policy,
    departments: { ...policy.departments }
  };
}

export function validatePolicy(policy) {
  const errors = [];
  if (!policy || typeof policy !== 'object') errors.push('Policy is required.');
  if (!policy?.version || typeof policy.version !== 'string') errors.push('Policy version is required.');
  for (const [name, value] of [['insuranceValueThreshold', policy?.insuranceValueThreshold], ['mailWeightLimit', policy?.mailWeightLimit], ['regularWeightLimit', policy?.regularWeightLimit]]) {
    if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push(`${name} must be a non-negative number.`);
  }
  if (Number(policy?.mailWeightLimit) >= Number(policy?.regularWeightLimit)) errors.push('Mail weight limit must be below regular weight limit.');
  for (const department of ['mail', 'regular', 'heavy']) {
    if (typeof policy?.departments?.[department] !== 'string' || !policy.departments[department].trim()) errors.push(`${department} department name is required.`);
  }
  return { valid: errors.length === 0, errors };
}

export function createPolicyStore(initialPolicy) {
  const policies = new Map();
  const initial = Object.freeze({ ...copyPolicy(initialPolicy), state: POLICY_STATES.ACTIVE, createdAt: new Date().toISOString(), activatedAt: new Date().toISOString() });
  const initialValidation = validatePolicy(initial);
  if (!initialValidation.valid) throw new Error(initialValidation.errors.join(' '));
  policies.set(initial.version, initial);
  let activeVersion = initial.version;

  function get(version) { return policies.get(version || activeVersion); }
  function list() { return [...policies.values()].map(copyPolicy); }
  function createDraft(policy) {
    const validation = validatePolicy(policy);
    if (policies.has(policy.version)) throw new Error(`Policy ${policy.version} already exists.`);
    const draft = Object.freeze({ ...copyPolicy(policy), state: POLICY_STATES.DRAFT, createdAt: new Date().toISOString() });
    policies.set(draft.version, draft);
    return { policy: copyPolicy(draft), validation };
  }
  function transition(version, state) {
    const current = get(version);
    if (!current) throw new Error(`Policy ${version} was not found.`);
    if (current.state === POLICY_STATES.ACTIVE && state !== POLICY_STATES.ROLLED_BACK) throw new Error('Active policies are immutable; create a new version.');
    if (state === POLICY_STATES.VALIDATED && current.state !== POLICY_STATES.DRAFT) throw new Error('Only draft policies can be validated.');
    if (state === POLICY_STATES.APPROVED && current.state !== POLICY_STATES.VALIDATED) throw new Error('Only validated policies can be approved.');
    if (state === POLICY_STATES.ACTIVE && current.state !== POLICY_STATES.APPROVED) throw new Error('Only approved policies can become active.');
    if (state === POLICY_STATES.ACTIVE && !validatePolicy(current).valid) throw new Error('Invalid policies cannot become active.');
    const next = Object.freeze({ ...copyPolicy(current), state, [`${state.toLowerCase()}At`]: new Date().toISOString() });
    policies.set(version, next);
    if (state === POLICY_STATES.ACTIVE) activeVersion = version;
    return copyPolicy(next);
  }
  return {
    get,
    list,
    getActive: () => get(),
    createDraft,
    validate: (version) => validatePolicy(get(version)),
    validateAndMark: (version) => {
      const result = validatePolicy(get(version));
      if (!result.valid) return result;
      return { ...result, policy: transition(version, POLICY_STATES.VALIDATED) };
    },
    approve: (version) => transition(version, POLICY_STATES.APPROVED),
    activate: (version) => transition(version, POLICY_STATES.ACTIVE),
    rollback: (version) => {
      const rolledBack = transition(version, POLICY_STATES.ROLLED_BACK);
      const fallback = [...policies.values()].reverse().find((policy) => policy.state === POLICY_STATES.ACTIVE);
      if (fallback) activeVersion = fallback.version;
      return rolledBack;
    },
    activeVersion: () => activeVersion
  };
}