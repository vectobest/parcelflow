# ParcelFlow Control Room

A parcel routing system rebuilt as a MERN-style application (MongoDB deliberately omitted -- see [ADR-007](docs/decisions/ADR-007-in-memory-persistence.md)): **Express + Node** API, **React** client, real **Google OAuth**. It doesn't just route parcels -- it explains every decision, makes policy changes safe to evolve, and gives an operator (or an admin) the tools to investigate when something goes wrong.

> This repository previously contained a different, vanilla-JS implementation of the same assessment brief in `backend/`/`frontend/`. It was replaced with this MERN rewrite at the user's request; the prior version remains in git history.

## 1. Product overview

The system answers the questions an operations team actually asks:

- **What happened?** Every routing decision cites the rule that matched, the policy version active at the time, and the evaluated conditions ([Decision Explainability](#decision-explainability)).
- **What needs attention?** The Overview page surfaces health, KPIs and an explicit "needs attention" list -- not just raw numbers.
- **What if we change a rule?** [Policy Blast Radius](#policy-lifecycle--blast-radius) replays a candidate policy against every parcel actually processed, before it can go live.
- **Can we reproduce a past decision?** [Decision Replay](#decision-replay) and the [Time Machine](#time-machine) reconstruct exactly what the system knew at any point in the session.
- **Is something going wrong?** [Risk & Predictions](#risk--predictions-heuristic-detection-optional-gemini-narration), the [Incident Center](#incident-center), and [Failure DNA](#failure-dna) group and explain failures instead of raising one alert per parcel.
- **What happens if volume spikes?** The [Digital Twin](#digital-twin) projects capacity impact without touching production.
- **Is it actually secure?** The [Security Center](#security--chaos-drills) runs real attack payloads against the real security code, live, and reports whether each was blocked.

## 2. Architecture at a glance

```
client/   React (Vite) -- pages, a small design system, AuthContext/ModeContext
server/   Express (Node, ESM) -- domain/service layers, in-memory repositories, Passport OAuth
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown (module responsibilities, data flow, the domain model, and why this stayed in-memory instead of adding MongoDB).

### SOLID in practice

- **SRP** -- `RoutingEngine` only runs rules; `PolicyService` only manages the lifecycle; `AuditService` only appends; `RetryService`, `IncidentDetectorService`, `FailureDnaService`, `DigitalTwinService` are each one concern, not folded into a god service.
- **OCP** -- new routing rules are added via `RoutingEngine.addRule()`, no edits to the engine itself (`server/src/routing/rules/*`).
- **LSP** -- every routing rule extends `RoutingRule` and returns a `RoutingDecision` or `null`; every repository extends its abstract base (`PolicyRepository`, `BatchRepository`, ...).
- **ISP** -- `PolicyRepository`, `BatchRepository`, `AuditRepository` are each a 2-3 method contract, not one god repository interface.
- **DIP** -- every service receives its dependencies through its constructor (see `server/src/container.js`, the single composition root). Nothing reaches into `process.env`, a database driver, or `fetch` directly.

## 3. Running it

Prerequisites: Node 20+.

```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env
npm run dev                      # server on :4000, client on :5173 (concurrently)
```

Open http://localhost:5173. Without Google OAuth configured, a **local dev sign-in** stands in (pick an email + role) -- see [Authentication](#authentication--rbac). The active policy starts at `v1` (Mail <=1kg, Regular <=10kg, Heavy above; insurance approval above EUR1000).

Run the test suites:

```bash
npm test              # server: 77 unit/integration/security/invariant tests (node:test)
npm run test:client   # client: 9 component tests (vitest)
```

### Enabling real Google OAuth

1. Create an OAuth 2.0 Client ID at https://console.cloud.google.com/apis/credentials (type: Web application).
2. Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `server/.env`.
4. Restart the server. The login page switches from local dev sign-in to a real "Sign in with Google" button automatically -- and **dev sign-in is refused by the server** the moment OAuth is configured (see [ADR-006](docs/decisions/ADR-006-oauth-with-dev-fallback.md)), so there's no accidental backdoor on a real deployment.

Optionally set `ADMIN_EMAILS` / `REVIEWER_EMAILS` (comma-separated) so specific accounts get elevated roles on first sign-in; everyone else starts as `OPERATOR`.

### Enabling real Gemini reasoning (optional)

The Operations Assistant and Risk engine work fully without this -- see [Operations assistant](#operations-assistant) and [Risk & Predictions](#risk--predictions-heuristic-detection-optional-gemini-narration) below. To turn on the Gemini-backed path:

1. Get a key at https://aistudio.google.com/apikey.
2. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-3.6-flash`) in `server/.env`.
3. Restart the server. Both features switch over automatically; every response they return carries `source: "gemini" | "heuristic"`, shown as a small badge in the UI.

**Free-tier note:** Google's free tier for `generativelanguage.googleapis.com` caps `gemini-3.6-flash` at roughly 5 requests/minute *and* 20 requests/day per project (confirmed live via the `RESOURCE_EXHAUSTED` error body, which names both `GenerateRequestsPerMinutePerProjectPerModel-FreeTier` and `GenerateRequestsPerDayPerProjectPerModel-FreeTier`). A `429` while testing is expected once you exceed either, not a bug. The SDK also appears to retry internally on 429/503 before giving up, so a single request can take well over a minute under quota contention. Either way, the app keeps working -- it falls straight back to the deterministic path and marks the response `source: "heuristic"`.

## 4. Feature tour

### Decision explainability
Every routing outcome (`RoutingDecision`) carries `matchedRule`, `reason`, `evaluatedConditions`, `policyVersion` and a `timestamp` -- shown in the Intake results table and reusable everywhere a decision appears (Approvals, Replay, the Assistant).

### Policy lifecycle & blast radius
Policies are immutable value objects (`server/src/domain/Policy.js`) that move `DRAFT -> VALIDATED -> APPROVED -> ACTIVE -> (ROLLED_BACK)`. An `ACTIVE` policy can never be mutated -- every change is a new version. Before activating a candidate, **Policy Manager** can check:
- **Rule conflicts** (`RuleConflictDetector`) -- overlapping weight tiers, a mail tier that can never be reached, an insurance threshold so low it swallows every other rule.
- **Blast radius** (`PolicyBlastRadiusService`) -- replays the candidate against *every parcel actually processed this session*, not a sample, and reports how many decisions would change.

### Decision replay
Pick any batch you've processed and replay it against a different policy version (**Decision Replay** page) to see exactly which parcels would be routed differently. Built on the same `RoutingEngine` as production traffic, so a replay can never drift from what actually happens.

### Risk & Predictions (heuristic detection, optional Gemini narration)
`RiskService` and `FailureDnaService` are transparent statistical heuristics over the current session's batches -- rising failure rate, growing approval backlog, failure fingerprinting with a trend. They explicitly report `INSUFFICIENT_DATA` rather than inventing a signal from too little history. The `level`, `confidence` and `evidence` are *always* this heuristic's own output; when `GEMINI_API_KEY` is set, `AiRiskNarrator` only rewrites the `message` into plainer language from that same evidence -- it can never change the score or invent a fact (see [ADR-009](docs/decisions/ADR-009-gemini-integration-boundaries.md)).

### Incident center
`IncidentDetectorService` groups related failures into one incident instead of one alert per parcel, with a minimum batch size before it will ever fire (a 2-parcel test batch can't manufacture a false incident) and a likely-cause citation from Failure DNA -- called "likely cause," never "root cause," since that's what the evidence actually supports.

### Digital twin
A linear, clearly-labeled ("SIMULATION -- NOT PRODUCTION") capacity projection over volume/processing-speed/reviewer-capacity/failure-rate multipliers. Never a trained model, and says so in its own output.

### Security & chaos drills
Admin-only, in **Security Center**:
- The **security drill** runs 8 real hostile inputs (oversized upload, malformed XML, an XXE-shaped payload, prototype pollution, unauthorized policy activation, unauthorized approval, invalid authentication, a replayed idempotency key) against the actual `SecureBatchParser` / `AuthorizationService` / `AuthenticationService` / `IdempotencyStore` code and reports whether each was genuinely blocked -- not a scripted narrative.
- The **chaos drill** synthesizes a failure and walks it through the real `IncidentDetectorService` and `AuditService`, tagged `drill: true` throughout, so the FAILURE -> DETECTION -> INCIDENT -> AUDIT lifecycle it demonstrates is genuine machinery -- but it never creates a real batch, policy or approval.

### Time machine
`SystemHistoryService` reconstructs system state (active policy, failure rate, approval queue size, open incidents) at any past timestamp, derived from the timestamps the app already recorded -- no separate snapshot store to keep in sync or drift out of.

### Operations assistant
Without `GEMINI_API_KEY`: a fixed set of recognized question patterns, answered only from live application data, always citing the specific IDs it used -- an unrecognized question gets an honest "I can't answer that," never a guess. With it: `AiOperationsAssistantService` lets Gemini reason about which of a handful of read-only tools (get a policy, a batch, an incident, the risk assessment, a digital-twin projection...) to call, but it can only state facts those tools actually returned, must cite the IDs, and falls straight back to the deterministic pattern-matcher above if it ever fails to produce a grounded answer. See [AI_USAGE.md](AI_USAGE.md) and [ADR-009](docs/decisions/ADR-009-gemini-integration-boundaries.md).

### Authentication & RBAC
Real Passport Google OAuth 2.0, session-cookie based. Three roles -- `OPERATOR`, `REVIEWER`, `ADMIN` -- enforced **server-side** in `AuthorizationService` (every controller calls `assertPermission`/`assertRole`; the client never gets to decide what it's allowed to do). Access Control (admin-only) lists everyone who has signed in and lets an admin change roles live.

## 5. Security

See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for the full threat model. Highlights:

- **XXE / entity expansion**: `fast-xml-parser` has no DTD/entity-resolution engine at all (not just disabled by a flag), and any payload containing `<!DOCTYPE` / `<!ENTITY` is rejected outright before parsing, as a second layer.
- **Prototype pollution**: uploaded JSON/XML is checked for `__proto__`/`constructor`/`prototype` keys before anything downstream touches it (`fast-xml-parser` itself also refuses those as tag names).
- **Size limits**: uploads are rejected by byte size *before* parsing (`MAX_UPLOAD_BYTES`), and by record count after.
- **RBAC**: enforced in `AuthorizationService`, called from every mutating controller and from the services themselves (defense in depth -- a controller bug can't bypass it).
- **Rate limiting**: a stricter limiter on `/api/auth/*` than the rest of the API.
- **Secure headers**: `helmet` with an explicit CSP; no inline scripts.
- **No secrets in the client**: OAuth client secret, session secret, Gemini API key and admin email allowlist all live server-side only (`server/.env`, gitignored). The client never sees `GEMINI_API_KEY`; it only ever talks to `POST /api/assistant/ask` and `GET /api/risk` on our own server, which calls Gemini itself.
- **Audit trail**: append-only (`InMemoryAuditRepository.add` never removes or edits), admin-only to read.
- **Error handling**: unknown errors are logged with full detail server-side but the client only ever sees a generic message + correlation ID -- never a stack trace.

Run the security drill (Security Center, as an admin) to see these controls exercised live.

## 6. Testing strategy

85 server tests (`npm test`, Node's built-in test runner) across `server/tests/{unit,integration,security,invariants}`:
- **Unit**: routing engine, policy lifecycle, rule conflicts, blast radius, batching, approvals, retry classification, risk heuristics, incident detection, failure DNA, digital twin, the operations assistant, and the Gemini tool-calling/fallback/grounding logic (against a scripted fake client -- no API key needed to run the suite).
- **Integration** (`supertest` against the real Express app): auth flow, RBAC over HTTP, the dev-login backdoor being refused once OAuth is configured, oversized/malformed uploads rejected at the HTTP layer.
- **Security**: XXE, prototype pollution, oversized uploads, malformed input, RBAC, the security drill itself.
- **Invariants**: six explicitly named tests for the properties that must never break (see `server/tests/invariants/invariants.test.js`) -- an invalid parcel never routes normally, an active policy is never silently mutated, retry never double-processes, simulation never touches production state, an unauthorized role never activates a policy, every state change is audited.

9 client tests (`npm run test:client`, Vitest + Testing Library): the sample-batch generator, the command palette's filtering, and the login flow's dev sign-in path.

**What's not covered**: no browser-automation (Playwright/Cypress) end-to-end suite is checked in. The full click-through flow (login -> intake -> approvals -> policy lifecycle -> replay -> risk -> incidents -> digital twin -> assistant -> security drill -> audit -> access control -> command palette -> mobile layout) was verified manually via a headless-Chrome DevTools Protocol session during development, not as a repeatable CI suite -- a real next step (see [Known limitations](#8-known-limitations--future-improvements)).

## 7. AI usage

See [AI_USAGE.md](AI_USAGE.md).

## 8. Known limitations & future improvements

- **No database.** Explicitly requested this way (see [ADR-007](docs/decisions/ADR-007-in-memory-persistence.md)) -- all state is in-memory and lost on restart. A real deployment would swap the `InMemoryXRepository` classes for MongoDB-backed ones behind the same repository interfaces; nothing else would need to change.
- **Risk/incident heuristics are session-scale.** They work well within one server run but have no long-term historical baseline across restarts (again, a consequence of no persistence).
- **No E2E test automation checked in**, per the note above.
- **Without `GEMINI_API_KEY`, the Operations Assistant's question set is fixed.** Extending it means adding a new pattern to `OperationsAssistantService`. With a key, Gemini can handle a much wider range of phrasings, but it's still bounded to the same handful of read-only tools -- a genuinely new *kind* of question still needs a new tool.
- **Digital Twin is a linear projection**, not a queueing-theory or ML model -- fine as an order-of-magnitude estimate, not a capacity-planning guarantee.
- **Single-process rate limiting / session store.** `express-rate-limit`'s default store and `express-session`'s `MemoryStore` are per-process; a multi-instance deployment would need a shared store (Redis) for both.
- Natural next step if this became a real product: MongoDB persistence behind the existing repository interfaces, a Redis-backed session/rate-limit store for horizontal scaling, and a checked-in Playwright E2E suite.

## 9. Extending the routing rules

```js
// server/src/routing/rules/ExpressCountryRule.js
export class ExpressCountryRule extends RoutingRule {
  evaluate(parcel, policy, context) {
    if (parcel.destinationCountry !== 'NL') return null;
    return RoutingDecision.routed({ policy, parcel, department: 'Express NL', matchedRule: 'EXPRESS_NL', reason: '...' });
  }
}
```

```js
// server/src/container.js
routingEngine.addRule(new ExpressCountryRule(), { before: 'MailWeightRule' });
```

No other file changes. Add a matching unit test in `server/tests/unit/routing.test.js`.
