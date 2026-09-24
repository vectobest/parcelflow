import { Parcel } from '../domain/Parcel.js';
import { ValidationRule } from './rules/ValidationRule.js';
import { InsuranceApprovalRule } from './rules/InsuranceApprovalRule.js';
import { MailWeightRule } from './rules/MailWeightRule.js';
import { RegularWeightRule } from './rules/RegularWeightRule.js';
import { HeavyWeightRule } from './rules/HeavyWeightRule.js';

export const DEFAULT_POLICY = Object.freeze({
  version: 'v1',
  insuranceValueThreshold: 1000,
  mailWeightLimit: 1,
  regularWeightLimit: 10,
  departments: Object.freeze({ mail: 'Mail Department', regular: 'Regular Department', heavy: 'Heavy Department' })
});

export function defaultRoutingRules() {
  return [new ValidationRule(), new InsuranceApprovalRule(), new MailWeightRule(), new RegularWeightRule(), new HeavyWeightRule()];
}

/**
 * RoutingEngine evaluates a parcel against an ordered chain of RoutingRule
 * instances (Chain of Responsibility / Open-Closed Principle). It has a
 * single responsibility -- running the chain -- and depends only on the
 * RoutingRule abstraction, so it never needs to change when a business
 * rule changes.
 *
 * Extending the business without touching this file:
 *
 *   const engine = new RoutingEngine();
 *   engine.addRule(new ExpressCountryRule(), { before: 'MailWeightRule' });
 */
export class RoutingEngine {
  #rules;

  constructor({ rules = defaultRoutingRules() } = {}) {
    this.#rules = [...rules];
  }

  /** Registers a new rule. Pass `{ before: 'SomeRuleClassName' }` to insert it ahead of an existing rule. */
  addRule(rule, { before } = {}) {
    if (before) {
      const index = this.#rules.findIndex((existing) => existing.constructor.name === before);
      this.#rules.splice(index === -1 ? this.#rules.length : index, 0, rule);
    } else {
      this.#rules.push(rule);
    }
    return this;
  }

  get rules() { return [...this.#rules]; }

  route(rawParcel, policy = DEFAULT_POLICY, context = {}) {
    const parcel = rawParcel instanceof Parcel ? rawParcel : Parcel.fromInput(rawParcel);
    for (const rule of this.#rules) {
      const decision = rule.evaluate(parcel, policy, context);
      if (decision) return decision;
    }
    throw new Error('No routing rule produced a decision; check the rule chain configuration.');
  }

  routeBatch(parcels, policy = DEFAULT_POLICY) {
    if (!Array.isArray(parcels)) throw new TypeError('A parcel batch must be an array.');
    return parcels.map((raw, index) => {
      const parcel = raw instanceof Parcel ? raw : Parcel.fromInput(raw, index);
      return { id: parcel.id, parcel: parcel.toJSON(), outcome: this.route(parcel, policy) };
    });
  }
}
