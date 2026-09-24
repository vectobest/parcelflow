/** Contract every routing rule must satisfy (LSP): return a RoutingDecision to claim the parcel, or null to defer to the next rule in the chain. */
export class RoutingRule {
  evaluate(_parcel, _policy, _context) {
    throw new Error('RoutingRule.evaluate() must be implemented.');
  }
}
