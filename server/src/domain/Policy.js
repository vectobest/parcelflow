export const POLICY_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  VALIDATED: 'VALIDATED',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  ROLLED_BACK: 'ROLLED_BACK'
});

/**
 * Policy is an immutable entity: every state transition returns a *new*
 * Policy instead of mutating the current one. That makes "active policies
 * are immutable" a property of the type itself rather than something every
 * caller has to remember to respect (see docs/decisions/ADR-002).
 */
export class Policy {
  constructor({
    version,
    insuranceValueThreshold,
    mailWeightLimit,
    regularWeightLimit,
    departments,
    state = POLICY_STATES.DRAFT,
    createdBy = 'system',
    createdAt = null,
    validatedAt = null,
    approvedAt = null,
    activatedAt = null,
    rolledBackAt = null
  } = {}) {
    this.version = version;
    this.insuranceValueThreshold = insuranceValueThreshold;
    this.mailWeightLimit = mailWeightLimit;
    this.regularWeightLimit = regularWeightLimit;
    this.departments = Object.freeze({ ...departments });
    this.state = state;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.validatedAt = validatedAt;
    this.approvedAt = approvedAt;
    this.activatedAt = activatedAt;
    this.rolledBackAt = rolledBackAt;
    Object.freeze(this);
  }

  static validate(attrs) {
    const errors = [];
    if (!attrs || typeof attrs !== 'object') {
      errors.push('Policy is required.');
      return { valid: false, errors };
    }
    if (!attrs.version || typeof attrs.version !== 'string') errors.push('Policy version is required.');
    for (const [name, value] of [
      ['insuranceValueThreshold', attrs.insuranceValueThreshold],
      ['mailWeightLimit', attrs.mailWeightLimit],
      ['regularWeightLimit', attrs.regularWeightLimit]
    ]) {
      if (!Number.isFinite(Number(value)) || Number(value) < 0) errors.push(`${name} must be a non-negative number.`);
    }
    if (Number(attrs.mailWeightLimit) >= Number(attrs.regularWeightLimit)) errors.push('Mail weight limit must be below regular weight limit.');
    for (const department of ['mail', 'regular', 'heavy']) {
      if (typeof attrs.departments?.[department] !== 'string' || !attrs.departments[department].trim()) errors.push(`${department} department name is required.`);
    }
    return { valid: errors.length === 0, errors };
  }

  get isValid() { return Policy.validate(this).valid; }

  /** Returns a new Policy in `state`, stamping the matching `<state>At` timestamp. */
  withState(state, clock = () => new Date()) {
    const timestampField = `${state.toLowerCase()}At`;
    return new Policy({ ...this, departments: { ...this.departments }, state, [timestampField]: clock().toISOString() });
  }

  toJSON() {
    const { version, insuranceValueThreshold, mailWeightLimit, regularWeightLimit, departments, state, createdBy, createdAt, validatedAt, approvedAt, activatedAt, rolledBackAt } = this;
    return { version, insuranceValueThreshold, mailWeightLimit, regularWeightLimit, departments, state, createdBy, createdAt, validatedAt, approvedAt, activatedAt, rolledBackAt };
  }
}
