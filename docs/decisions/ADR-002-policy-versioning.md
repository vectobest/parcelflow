# ADR-002: Immutable, versioned policies with an explicit lifecycle

## Problem
Business rules (weight thresholds, insurance limit) need to change over time, but a routing decision made yesterday must remain explainable and reproducible today -- if a policy can be edited in place, "what policy made this decision" stops having a stable answer.

## Options considered
1. A single mutable policy object, edited in place.
2. A mutable policy with a separate change-log for audit purposes.
3. Immutable `Policy` value objects, one per version, moving through an explicit lifecycle (`DRAFT -> VALIDATED -> APPROVED -> ACTIVE -> ROLLED_BACK`).

## Decision
Option 3. `Policy` (`server/src/domain/Policy.js`) is constructed once and `Object.freeze()`'d; every transition (`withState()`) returns a *new* `Policy`. `PolicyService` is the only place transitions are validated, and it refuses to transition an `ACTIVE` policy to anything but `ROLLED_BACK` -- "active policies are immutable; create a new version" is enforced code, not a convention.

## Trade-offs
- Every policy change requires a new version and a re-run through the full lifecycle (draft, validate, approve, activate) -- more ceremony than editing a field, by design: it makes an accidental or unreviewed change to production routing structurally impossible.
- Historical policies accumulate in memory for the life of the process (acceptable at this scale; would need pruning or archival in a long-running production deployment with persistence).

## Consequences
- Decision Replay and Policy Blast Radius (ADR-005) are trivial to build correctly: they just route the same parcels through a different frozen `Policy` object, with zero risk of that object having changed underneath them.
- `PolicyService.rollback()` restores the previous `ACTIVE` policy by finding the most recent policy still in `ACTIVE` state after marking the rolled-back one -- there's always a well-defined "current" policy.
