# ADR-008: Rule conflict detection scoped to the real threshold model, not a fabricated generic rule DSL

## Problem
The original spec's "Rule Conflict Detector" and "Rule Builder" sections are written against an imagined open-ended rule engine (arbitrary conditions, explicit precedence, "Rule A -> Heavy, Rule B -> Regular" ambiguity). This application's actual routing model is a strict three-tier weight threshold plus a value-based insurance gate (`Policy.mailWeightLimit`/`regularWeightLimit`/`insuranceValueThreshold`) -- by construction, tiers can't overlap or be ambiguous as long as `mailWeightLimit < regularWeightLimit`, because `RoutingEngine` evaluates rules in a fixed order and the first match wins (ADR-001).

## Options considered
1. Build a generic rule DSL (arbitrary conditions, explicit precedence) just so "conflict detection" and "rule builder" have something open-ended to operate on, matching the spec's literal wording.
2. Skip rule-conflict detection and the rule builder entirely, since the literal spec doesn't apply to this domain model.
3. Implement both concepts against what the domain model actually is: the "rule builder" is the threshold-and-department-name editor already needed for policy drafts (Policy Manager); "conflict detection" checks the structural properties that *can* actually go wrong in this model.

## Decision
Option 3. `RuleConflictDetector.analyze()` (`server/src/policies/RuleConflictDetector.js`) checks: overlapping/inverted weight tiers (`mailWeightLimit >= regularWeightLimit`), an unreachable mail tier (limit <= 0), an insurance threshold so low it dominates every weight tier, and duplicate department names across tiers. Each finding says `ERROR` or `WARNING` and explains the real consequence in one sentence.

## Trade-offs
- This detector will never find "Rule A produces Heavy, Rule B produces Regular for the same input" in the literal sense the spec describes, because that specific ambiguity is structurally impossible in an ordered-threshold model. Building a fake version of that check against data that can't produce it would be worse than not having it: a false demonstration of rigor.
- If this system ever grows a genuinely open-ended rule DSL (arbitrary conditions per department), this detector would need a real rewrite at that point -- it is explicitly scoped to today's model, not a stub for tomorrow's imagined one.

## Consequences
- Every finding in `server/tests/unit/policyLifecycle.test.js`'s conflict-detector tests corresponds to a scenario that can actually happen with this policy shape, and each one is phrased in terms an operator (not an engineer) can act on.
- This ADR exists specifically so a future maintainer doesn't wonder why the "conflict detector" doesn't do what a generic rule-engine tutorial would suggest -- it's a deliberate scope decision, not an oversight.
