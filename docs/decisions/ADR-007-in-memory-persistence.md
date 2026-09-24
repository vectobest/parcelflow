# ADR-007: In-memory persistence, no database, despite the "MERN" label

## Problem
The application was requested as a "MERN stack" rebuild, but explicitly *without* using a database ("i guess there is no use of db, keep oauth" -- confirmed directly when asked to disambiguate). This is a real tension: MongoDB is the "M" in MERN, and every repository in this codebase is already designed behind an abstraction that a database implementation could sit behind.

## Options considered
1. Ignore the instruction and add MongoDB anyway, on the reasoning that "MERN" implies it.
2. Add MongoDB but make it optional/best-effort.
3. Honor the instruction exactly: in-memory repositories, MongoDB explicitly not added, and document the trade-off and the exact seam where it would plug in later.

## Decision
Option 3. Every `*Repository` class (`PolicyRepository`, `BatchRepository`, `ApprovalRepository`, `AuditRepository`) has an in-memory implementation (`InMemory*Repository`) injected via the composition root (`server/src/container.js`). Nothing outside those four small files knows or cares that storage is in-memory.

## Trade-offs
- All state (policies beyond the seeded `v1`, batches, approvals, audit history, incidents, users, sessions) is lost on server restart. This is a real, user-visible limitation, not a hidden one -- called out explicitly in the README's "Known limitations" section and on the Access Control page itself ("resets on server restart").
- Risk/incident heuristics (ADR referenced in AI_USAGE.md) have no cross-restart historical baseline as a direct consequence.
- In exchange: zero setup cost (no MongoDB connection string, no schema migrations, no seed scripts) for running or testing the app, and every test in `server/tests/` gets a guaranteed-clean, fully isolated data store for free via `createContainer()` -- no test database to reset between runs.

## Consequences
- Adding MongoDB later is a matter of writing `MongoPolicyRepository` etc. implementing the same repository base classes and swapping them in `container.js` -- no service, controller, or test would need to change, because none of them depend on how a repository stores data, only on its `get`/`list`/`save`/`has` contract.
- This decision is the reason the project is "ERN with a Mongo-shaped seam" rather than literally MERN today; the seam is real, not aspirational.
