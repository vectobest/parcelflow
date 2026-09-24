# ADR-001: Routing engine as an ordered rule chain (Chain of Responsibility)

## Problem
Routing logic needs to be adaptable to business change (new departments, new conditions) without rewriting or risking the core engine, and every decision must be deterministic and reproducible for replay/simulation to mean anything.

## Options considered
1. A single function with nested `if`/`else` on weight and value.
2. A declarative rules table (JSON) interpreted by a generic evaluator.
3. Chain of Responsibility: an ordered list of `RoutingRule` objects, first match wins.

## Decision
Option 3. `RoutingEngine` holds an ordered array of `RoutingRule` instances (`ValidationRule`, `InsuranceApprovalRule`, `MailWeightRule`, `RegularWeightRule`, `HeavyWeightRule`). Each implements `evaluate(parcel, policy, context)` and returns a `RoutingDecision` to claim the parcel or `null` to defer. `addRule(rule, { before })` inserts a new rule without touching existing ones.

## Trade-offs
- A declarative rules table (option 2) would let non-engineers edit rules without a deploy, but at the cost of a much larger surface to validate and secure (an interpreter for arbitrary conditions is itself an attack surface and a source of ambiguity -- see ADR-008 for why an open-ended rule DSL was explicitly not built).
- Option 3 requires a code change (and a test) to add a rule, but that change is small, isolated, and reviewable, and the engine itself never needs to change.

## Consequences
- Adding a rule is `engine.addRule(new X(), { before: 'Y' })` plus a new file -- no edits to `RoutingEngine`.
- Every rule is independently unit-testable in isolation (see `server/tests/unit/routing.test.js`).
- Rule order matters and is explicit and inspectable (`engine.rules`), rather than implicit in a giant conditional's structure.
