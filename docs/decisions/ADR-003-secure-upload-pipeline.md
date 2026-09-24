# ADR-003: Secure-by-construction upload pipeline, not a sanitization pass

## Problem
Batch uploads (JSON or XML) are untrusted input from a public-internet-facing endpoint. Common failure mode: treat "we validate the schema" as sufficient, and miss XXE, entity expansion, prototype pollution, or resource-exhaustion attacks that happen *during parsing*, before schema validation ever runs.

## Options considered
1. A general-purpose XML library (e.g. `xml2js`, or Node's non-existent built-in) with entity resolution manually disabled via configuration flags.
2. A SAX-based streaming parser with manual entity-handling callbacks.
3. `fast-xml-parser`, which has no DTD/external-entity resolution capability at all, plus an explicit pre-parse rejection of any `DOCTYPE`/`ENTITY` declaration, plus a byte-size cap before parsing, plus a prototype-pollution key check after.

## Decision
Option 3, implemented in `SecureBatchParser` (`server/src/batches/SecureBatchParser.js`) as a single pipeline: size limit -> format-specific safe parse -> structural (prototype-pollution) guard -> record-count limit. JSON goes through the same structural guard even though `fast-xml-parser` isn't involved, since `JSON.parse` has no such protection built in.

## Trade-offs
- Relying on "the library has no entity engine" instead of "we remembered to disable entity resolution" removes an entire class of configuration-drift risk (a future dependency bump or config change can't silently re-enable it), at the cost of depending on that library's continued behavior -- mitigated by the explicit DOCTYPE/ENTITY rejection as a second, independent layer that doesn't rely on the parser's internals at all.
- Filenames and content-types from the client are never trusted (see the threat model) -- the format is passed explicitly by the caller based on what the user selected, not sniffed from an untrusted filename.

## Consequences
- The full pipeline is one class with one public method (`parse(text, format)`), independently unit-tested against XXE, entity-expansion-shaped payloads, prototype pollution (both JSON and XML), oversized input, and malformed input (`server/tests/security/secureBatchParser.test.js`).
- The security drill (`SecurityDrillService`) exercises this exact class live, at runtime, rather than only in a test file -- see ADR-004's sibling reasoning about the chaos drill: a security control is only really demonstrated when it's shown failing hostile input for real.
