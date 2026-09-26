# ADR-010: Optional MongoDB persistence through a synchronous, write-through cache

## Problem
ADR-007 kept the app entirely in-memory by request, with every repository already built behind a small interface (`get`/`list`/`save`/`has`) for exactly this reason: "adding MongoDB later is a matter of writing `MongoPolicyRepository` etc. implementing the same repository base classes and swapping them in `container.js`." A MongoDB Atlas cluster was later provisioned and its connection string handed over, so that seam needed to be used.

The obvious approach -- make every repository method `async` and return a `Promise` -- is also the expensive one: every service method that calls a repository (`PolicyService`, `AuditService`, `ApprovalService`, `BatchService`, `IncidentDetectorService`, `RetryService`, `UserStore`, and everything built on top of them) would need to become `async` too, cascading into every controller and all 102 server tests. That is a rewrite of most of the codebase's call graph, days before a demo, for an app that runs as a single process with no plan to run more than one (see ADR-007's own framing).

## Options considered
1. Make every repository (and everything that calls one) fully async, backed directly by MongoDB reads and writes.
2. A synchronous in-memory cache per repository, hydrated from MongoDB once at boot, with every write mirrored to MongoDB in the background.
3. Leave everything in-memory, since MongoDB is provisioned but nothing requires it yet.

## Decision
Option 2. `server/src/db/MongoBackedMap.js` is a `Map` that reads synchronously from memory and fires every `set`/`delete` at a MongoDB collection without waiting for it, catching and logging any failure instead of throwing. Each domain repository (`server/src/db/mongoRepositories.js`) is a thin adapter over one of these maps, implementing the exact same interface as its `InMemory*Repository` counterpart. `UserStore` was changed only to accept its two internal maps through its constructor (defaulting to plain `Map`s, so its own behavior is unchanged) instead of always creating them itself, so it can be handed one of these instead.

`createContainer()` (`server/src/container.js`) gained one new parameter, `repositories`, defaulting to `{}`; any repository not supplied falls back to its original in-memory class exactly as before. `server.js` is the only caller that ever supplies it: if `MONGODB_URI` is set, it connects and hydrates every collection *before* building the container; if it isn't set, or the connection fails, the container is built exactly as it always was. Every one of the 102 server tests calls `createContainer()` with no `repositories`, so none of them changed, and none of them need a database to run.

## Trade-offs
- **A write that fails is lost, not retried.** If MongoDB is briefly unreachable when a batch is processed, the batch is still fully usable in memory for the rest of that process's life, but it won't survive that process's next restart unless something else causes the same document to be written again. This is a real gap, and it's why the failure is logged (`mongo_write_failed`, with the collection and key) rather than swallowed silently -- an operator watching logs would see it. Verified live during development: a background write that had a read cut short by closing the connection mid-flight logged exactly this event and nothing else broke.
- **Not a shared live store.** Two server processes pointed at the same MongoDB database would each keep their own in-memory copy and would not see each other's writes until they restarted. This matches the app's actual deployment shape today (ADR-007: a single process, no horizontal scaling), and is a real constraint on any future multi-instance deployment.
- **Read scaling is unaffected either way.** Reads were already O(1) Map lookups; they still are. Persistence changed nothing about read performance, only about what survives a restart.
- **Every write is a full-document replace.** `replaceOne(..., { upsert: true })` on the whole object, not a partial update. Simple and matches how these objects are already constructed (each mutation already builds a whole new object, e.g. `{ ...batch, retryCount: ... }`), at the cost of moving slightly more data over the wire per write than a targeted `$set` would.

## Consequences
- Persistence is entirely optional and additive: `MONGODB_URI` unset (the default) means the app behaves exactly as it did under ADR-007, byte-for-byte, and every existing test proves it. Set it, and policies, batches, approvals, incidents, audit events, users and pre-assigned roles all survive a restart.
- `GET /api/health` now reports `persistenceEnabled`, so it's visible from outside the process whether a given deployment is backed by a database.
- If this app ever needs to run as more than one process, the next step is not "add a database" (already done) but "make the cache coherent across processes" -- either move reads behind the same async calls option 1 described, or add a change-stream/pub-sub layer that pushes another process's writes into this one's in-memory map. Both are additive to what exists now, not a rewrite of it.
