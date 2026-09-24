# ADR-005: Policy blast radius replays full history, not a sample

## Problem
Before activating a policy change, an operator needs to know its real-world impact. A statistically-sampled or synthetically-generated preview can miss exactly the edge cases (a specific country, a specific weight band) that matter most for a real decision.

## Options considered
1. Generate a synthetic sample batch and simulate against it (fast, always available, but not real data).
2. Sample a subset of historically processed parcels.
3. Replay the candidate policy against *every* parcel actually processed this session.

## Decision
Option 3. `PolicyBlastRadiusService.analyze()` (`server/src/policies/PolicyBlastRadiusService.js`) pulls every parcel from every batch (`batchService.list().flatMap(...)`) and routes it through both the current and candidate policy, reporting every decision that changed -- not an estimate, an exact count.

## Trade-offs
- Cost scales with total historical parcel volume (two full routing passes). At the scale this in-memory, single-session application operates at, that's negligible; a persistent deployment with millions of historical parcels (see ADR-007) would need to reintroduce sampling or pagination for this specific calculation.
- The **Impact Simulator** page still uses a generated sample (`generateSampleBatch`) for a fast, always-available "what if" exploration when you don't want to wait on real history or haven't processed anything real yet -- the two features are complementary, not redundant: Simulator for exploration, Blast Radius for the real pre-activation check.

## Consequences
- Blast radius correctly reports "No historical parcels yet" instead of a misleading synthetic number when nothing has been processed (see the corresponding unit test).
- Because it shares the exact same `RoutingEngine` as production traffic (ADR-001), the blast-radius number can never drift from what activation would actually do.
