/**
 * RoutingRule is the extension point for the Open/Closed Principle: the
 * engine below never changes when the business adds a department or a new
 * routing condition. Each rule is one focused class (SRP) that either
 * returns a RoutingDecision (it "claims" the parcel) or null (defer to the
 * next rule in the chain). This is the Chain-of-Responsibility pattern.
 */
export class RoutingRule {
  /**
   * @param {import('../domain/Parcel.js').Parcel} _parcel
   * @param {import('../domain/Policy.js').Policy} _policy
   * @param {{ insuranceApproved?: boolean }} _context
   * @returns {import('../domain/RoutingDecision.js').RoutingDecision|null}
   */
  evaluate(_parcel, _policy, _context) {
    throw new Error('RoutingRule subclasses must implement evaluate().');
  }
}
