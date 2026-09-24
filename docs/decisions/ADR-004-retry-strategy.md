# ADR-004: Retry classification grounded in what's actually retryable

## Problem
The routing engine is a pure, deterministic function of `(parcel, policy)`. A structurally invalid parcel (negative weight, missing country) will fail identically on every retry attempt unless either the data or the active policy changes. A naive bounded-retry-with-backoff implementation (the textbook pattern) would silently spend its whole retry budget re-running a check that can never pass -- "retry theater," not reliability engineering.

## Options considered
1. Generic bounded retry with backoff, applied uniformly to every failed parcel.
2. Bounded retry, but re-evaluate against the *current* active policy each attempt (which may have changed since the original run) and classify what's still wrong instead of just counting attempts.
3. No retry at all -- require a fresh batch resubmission for any failure.

## Decision
Option 2, in `RetryService` (`server/src/retry/RetryService.js`), deliberately kept separate from `BatchService` (see ARCHITECTURE.md). Each retry re-routes only parcels currently in `error` status against the *current* active policy and classifies the outcome:
- **RESOLVED** -- now routes successfully (e.g. because the active policy changed).
- **MANUAL_REVIEW** -- still fails, retries remain; the data itself needs a human fix.
- **DEAD_LETTER** -- exhausted the configured retry budget (`MAX_RETRIES`); stop auto-retrying.

## Trade-offs
- This means most validation failures in this system will never auto-resolve via retry (weight/value/country problems are data problems, not transient ones) -- which is the honest outcome, not a limitation to hide. The mechanism exists for the case that *does* legitimately change between attempts: an active-policy change.
- Option 3 (no retry) would have been simpler but loses the legitimate "policy changed, replay against current policy" case and the explicit dead-letter signal that something needs escalation.

## Consequences
- `server/tests/unit/retryService.test.js` explicitly asserts a deterministic failure is never marked `RESOLVED` and that the retry count is bounded (dead-letters instead of looping forever) -- this is one of the named invariants (`server/tests/invariants/invariants.test.js`: "retry never creates duplicate successful side effects").
- Every retry attempt is audited (`retry_completed` / `retry_blocked_dead_letter`), so the retry history is investigable after the fact.
