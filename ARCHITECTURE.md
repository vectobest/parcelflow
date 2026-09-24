# Architecture

## System architecture

```
                    ┌─────────────────────────┐
                    │   React client (Vite)   │
                    │  pages / AuthContext /  │
                    │  ModeContext / api/     │
                    └────────────┬────────────┘
                                 │ fetch, credentials: include
                                 │ (Vite dev proxy -> :4000/api)
                    ┌────────────▼────────────┐
                    │   Express app (server)  │
                    │  security headers, CORS,│
                    │  rate limit, sessions,  │
                    │  Passport, controllers  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Application services   │
                    │  PolicyService, Batch-   │
                    │  Service, RetryService,  │
                    │  IncidentDetector, ...   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      Domain layer        │
                    │  Parcel, Policy,         │
                    │  RoutingDecision,        │
                    │  RoutingEngine + rules   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   In-memory repositories │
                    │  (see ADR-007)            │
                    └───────────────────────────┘
```

`server/src/container.js` is the single composition root: it is the only file that imports every concrete class and wires them together via constructor injection. Every service depends on abstractions (a repository base class, another service's public interface), never on a concrete database, HTTP framework, or `process.env` directly.

## Module responsibilities (server)

| Path | Responsibility |
|---|---|
| `domain/` | Pure value objects and invariants: `Parcel`, `Policy` (immutable, versioned), `RoutingDecision` (frozen), `Incident` (constants). No I/O. |
| `routing/` | `RoutingEngine` (Chain of Responsibility over `RoutingRule`s) + `rules/*` (one class per business rule). |
| `policies/` | `PolicyService` (lifecycle), `RuleConflictDetector`, `PolicyBlastRadiusService`, repository + in-memory implementation. |
| `approvals/` | `ApprovalService` (insurance-hold workflow), repository + implementation. |
| `batches/` | `BatchService` (create/read only -- see below), `SecureBatchParser` (untrusted-input pipeline), `IdempotencyStore`, repository + implementation. |
| `analysis/` | `DecisionComparisonService` (simulate + replay, shared compare logic). |
| `intelligence/` | `RiskService`, `FailureDnaService`, `IncidentDetectorService` + its repository. |
| `simulation/` | `DigitalTwinService` (capacity projection). |
| `retry/` | `RetryService` (classification + bounded retry, deliberately separate from `BatchService` -- see below). |
| `history/` | `SystemHistoryService` (Time Machine, derived from recorded timestamps). |
| `assistant/` | `OperationsAssistantService` (pattern-matched Q&A over live data). |
| `drills/` | `ChaosDrillService`, `SecurityDrillService` (admin-only, simulation-labeled). |
| `auth/` | `AuthenticationService` (bearer tokens for machine callers), `AuthorizationService` (RBAC), `UserStore`, Passport configuration. |
| `reporting/` | `DashboardService` (read model composing several services for the Overview page). |
| `http/` | Express-specific: middleware, controllers (one per feature area), route composition. |
| `config/`, `logging/`, `errors/`, `concurrency/` | Cross-cutting: validated config, structured/masked logging, typed error hierarchy, `AsyncGate` concurrency bound. |

### Why `BatchService` never retries

`BatchService.process()` only ever creates a batch; it has no `retry()` method. Retrying is a distinct concern (classification, bounded attempts, re-evaluating against a possibly-changed policy) owned entirely by `RetryService`, which shares the same `BatchRepository` rather than going through `BatchService`. This is a deliberate SRP call: a class that both creates and mutates/retries the same aggregate tends to accumulate special cases over time.

## Domain model

```
Parcel { id, weight, value, destinationCountry, recipient }
Policy { version, mailWeightLimit, regularWeightLimit, insuranceValueThreshold,
         departments, state, createdBy, createdAt, validatedAt, approvedAt,
         activatedAt, rolledBackAt }                    -- immutable, frozen
RoutingDecision { status, decision, department, parcelId, validation,
                  matchedRule, reason, evaluatedConditions, message,
                  policyVersion, timestamp }             -- immutable, frozen
Batch { batchId, idempotencyKey, correlationId, source, actor, state,
        stateHistory, createdAt, completedAt, policyVersion, results,
        approvalRecords, retryCount, deduplicated }
Approval { approvalId, batchId, parcelId, parcel, state, policyVersion,
           createdAt, decidedAt, decidedBy, correlationId }
Incident { incidentId, detectedAt, status, severity, failureRateBefore,
           failureRateAfter, relatedBatchIds, evidenceCount, likelyCause,
           recommendedActions }
AuditEvent { eventId, timestamp, actor, action, entity, entityId,
             previousValue, newValue, result, metadata, correlationId }
User { email, name, avatarUrl, provider, role, createdAt }
```

## Data flow: routing a batch

```
Upload (JSON/XML text) or manual parcels
        │
        ▼
SecureBatchParser.parse()        size limit -> DOCTYPE/ENTITY rejection ->
        │                        safe parse -> prototype-pollution check -> record-count limit
        ▼
BatchService.process()           authz check -> idempotency reservation ->
        │                        active-policy check -> RoutingEngine.routeBatch()
        ▼
RoutingEngine (per parcel)       ValidationRule -> InsuranceApprovalRule ->
        │                        MailWeightRule -> RegularWeightRule -> HeavyWeightRule
        ▼
RoutingDecision (frozen)         status/department/matchedRule/reason/evaluatedConditions
        │
        ├──► ApprovalService.createForBatch()   (for any `pending` result)
        ├──► AuditService.record('batch_processed')
        └──► IncidentDetectorService.detectFromBatch()   (from the controller, after processing)
```

## Policy lifecycle

```
createDraft() ──► DRAFT ──validateAndMark()──► VALIDATED ──approve()──► APPROVED ──activate()──► ACTIVE
                                                                                         │
                                                                                    rollback()
                                                                                         ▼
                                                                                   ROLLED_BACK
```

`Policy.withState()` always returns a *new* frozen `Policy`; nothing in the codebase ever assigns to a `Policy` field after construction. `PolicyService.#transition()` is the only place state changes are validated (e.g. "active policies are immutable; create a new version" is enforced there, not scattered across callers).

## Incident lifecycle

```
Batch processed
      │
IncidentDetectorService.detectFromBatch()
      │  guards: batch.results.length >= 5 (no incident from a tiny sample)
      │          failure rate crosses threshold relative to baseline (or >=30% with no baseline)
      ▼
  new Incident (NEW) ──or── folded into an existing open incident from the last 30 min
      │
  transition(status) ──► ACKNOWLEDGED ──► INVESTIGATING ──► MITIGATING ──► RESOLVED
      │  (admin-only, HTTP layer; each transition audited)
```

## Security boundaries

- **Client never decides authorization.** Every mutating route re-checks the role server-side via `AuthorizationService`; the client hiding a button is a UX nicety, not a security control.
- **Untrusted input never reaches domain logic unparsed.** All batch uploads go through `SecureBatchParser` before a single `Parcel` object is constructed.
- **Session vs. bearer are two independent authentication paths** (`attachIdentity` middleware), both resolving to the same `req.identity = { actor, role }` shape the rest of the app consumes -- controllers never know which one authenticated the request.
- **Passport is per-container, not the package singleton** (`auth/passport.js` uses `new Passport()`), so multiple containers (every test file, potentially multiple server instances) never share serializer state -- see the corresponding fix note in that file.

## Simulation architecture

`DecisionComparisonService` (simulate + replay), `PolicyBlastRadiusService`, and `DigitalTwinService` are all read-only by construction: none of them holds a reference to a repository's `save()` method, only to read methods (`list()`, `get()`). Simulating or replaying literally cannot mutate state because the objects it depends on don't expose a way to.

## Prediction/heuristic architecture

`RiskService` and `FailureDnaService` compute statistics over `batchService.list()` / `approvalService.list()` -- no external model, no training data, no persisted state beyond the batches themselves. Both explicitly return an "insufficient data" / zero-confidence result below a minimum sample size rather than extrapolating from noise. See [AI_USAGE.md](AI_USAGE.md) for why this is heuristic rather than ML.

## Audit architecture

`AuditService.record()` is called from controllers (which know the acting identity) for governance actions (policy lifecycle, approvals, logins, drills, permission changes) and from `BatchService`/`RetryService` directly for their own actions. `InMemoryAuditRepository.add()` only ever pushes to an internal array -- there is no update or delete method on the class at all, so "audit history is append-only" is a property of the type, not a convention callers have to respect.
