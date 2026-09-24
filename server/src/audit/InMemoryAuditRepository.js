import { AuditRepository } from './AuditRepository.js';

/** Append-only by construction: nothing in this class ever removes or edits an entry (see docs/THREAT_MODEL.md, "audit tampering"). */
export class InMemoryAuditRepository extends AuditRepository {
  #records = [];
  add(entry) { this.#records.push(Object.freeze(entry)); return entry; }
  list() { return [...this.#records]; }
}
