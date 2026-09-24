# Threat model

Scope: a Node/Express API and React client for an internal parcel-routing control room, deployed facing the public internet, with real Google OAuth for identity.

For each threat: what the risk is, what mitigates it, and where in the code.

## Malicious / malformed uploads

| Threat | Mitigation | Where |
|---|---|---|
| Oversized file (resource exhaustion) | Byte-size check *before* parsing | `SecureBatchParser.parse()`, `server/src/batches/SecureBatchParser.js` |
| Malformed JSON | `JSON.parse` wrapped in try/catch, rejected with a clear message | same |
| Malformed XML | `fast-xml-parser` validation mode, rejected with a clear message | same |
| XXE (external entity injection) | `fast-xml-parser` has no DTD/entity-resolution engine at all -- structurally cannot dereference an external entity, not just "disabled by a flag." A DOCTYPE/ENTITY declaration is also rejected outright before parsing, as a second, defense-in-depth layer (and the strongest signal of a hostile payload for a format that never needs one). | same |
| Entity expansion / "billion laughs" | Same as XXE -- no entity engine to expand anything, plus the byte-size cap makes even a naive expansion attempt moot | same |
| Prototype pollution (`__proto__`/`constructor`/`prototype` keys) | Explicit recursive key check on every parsed object before it's used; `fast-xml-parser` additionally refuses those as XML tag names on its own | `assertNoPrototypePollution()`, same file |
| Oversized record count | Record-count check after parsing, before routing | same |
| Path traversal via filename | Filenames are never trusted or used for storage -- the client reads the file as text and posts the *content*; the server generates its own internal batch ID (`randomUUID()`) | `BatchController`, `BatchService.process()` |

## Authentication & session

| Threat | Mitigation |
|---|---|
| Brute force against sign-in | Dedicated, stricter rate limiter on `/api/auth/*` (`authRateLimiter`, 20/15min) vs. the general API limiter |
| Session fixation / theft | `httpOnly`, `sameSite: 'lax'` cookies; `secure: true` when `NODE_ENV=production` |
| Dev-login used as a backdoor in production | `POST /api/auth/dev-login` refuses to run at all once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are configured (checked server-side, not just hidden client-side) -- see ADR-006 |
| Invalid/forged bearer tokens | Constant-time comparison (`timingSafeEqual`); zero tokens accepted unless `SERVICE_TOKENS` is explicitly configured |
| Passport global-state leakage across app instances | Each container gets its own `Passport` instance rather than the package's process-wide singleton (see the note in `auth/passport.js`) |

## Authorization

| Threat | Mitigation |
|---|---|
| Unauthorized policy activation / approval / drill access / audit read | `AuthorizationService.assertPermission()` called server-side in every mutating/sensitive controller, keyed off `req.identity.role` resolved by the server, never a client-supplied role |
| IDOR (acting on another user's/entity's resource) | Entities are looked up server-side by ID from server-held collections; there is no client-supplied ownership token to spoof, and role checks gate the *action*, not just visibility |
| Client-side-only authorization | Never relied upon -- every check above happens server-side; the client hiding a button is UX, not security |

## Replay & duplication

| Threat | Mitigation |
|---|---|
| Duplicate batch submission (double-processing) | `IdempotencyStore`: a repeated `idempotencyKey` returns the original result instead of reprocessing; a key already in flight is rejected with a conflict, not silently reprocessed |
| Retry causing duplicate side effects | `RetryService` re-evaluates only parcels still in `error` status and is bounded by `MAX_RETRIES`; see the invariant test `retry never creates duplicate successful side effects` |

## Information leakage

| Threat | Mitigation |
|---|---|
| Stack traces / internals exposed to clients | `errorHandler` middleware: known `AppError`s return their own safe message; anything else logs full detail server-side and returns a generic message + correlation ID only |
| Secrets in logs | `Logger` masks any field named `password`/`token`/`secret`/`authorization`/`cookie` (case-insensitive) recursively before writing |
| Secrets in the client bundle | OAuth client secret, session secret, admin allowlist all read from `server/.env` (gitignored) and never sent to the client |
| Verbose error messages aiding enumeration | Error messages describe *what's wrong with the request*, not internal state (e.g. "Batch must contain between 1 and 5000 parcels," never a stack trace or file path) |

## Injection

| Threat | Mitigation |
|---|---|
| Log injection | Structured JSON logging (one `JSON.stringify`'d object per line) -- untrusted values become JSON string values, not raw text that could forge a fake log line |
| NoSQL/SQL injection | Not applicable: no database in this deployment (see ADR-007); if MongoDB is added later, Mongoose's parameterized queries and the same input-validation boundary this app already has would apply |
| XSS | React escapes all rendered content by default; no `dangerouslySetInnerHTML` anywhere in the client; `helmet`'s CSP additionally blocks inline scripts as defense in depth |

## Denial of service

| Threat | Mitigation |
|---|---|
| Request flood | `express-rate-limit` on all of `/api` (configurable window/max), a stricter one on `/api/auth` |
| Slow-client / connection exhaustion | `AsyncGate` bounds in-flight request processing to a configurable concurrency limit |
| Oversized request body | `express.json({ limit })` sized to `MAX_UPLOAD_BYTES` + headroom, independent of `SecureBatchParser`'s own check on the *parcel content* field |

## CSRF

Cross-site request forgery is limited by `sameSite: 'lax'` session cookies (the default posture for this deployment) plus CORS restricted to `CLIENT_ORIGIN` with `credentials: true` only for that origin. A production deployment serving the client from a different domain than intended should keep these two in lockstep, and could add a CSRF token for state-changing form submissions if the session cookie ever needs `sameSite: 'none'`.

## Explicitly out of scope for this assessment

- Distributed rate limiting / session store (single-process `MemoryStore` assumed -- see README limitations).
- WAF / network-layer DDoS protection (assumed to sit in front of this app, e.g. a cloud load balancer).
- Secrets management beyond `.env` (a real deployment would use a secrets manager, not a `.env` file, for `SESSION_SECRET`/`GOOGLE_CLIENT_SECRET`).
