import { AuditRepository } from './AuditRepository.js';

export class InMemoryAuditRepository extends AuditRepository {
  #records = [];
  add(entry) { this.#records.push(entry); return entry; }
  list() { return [...this.#records]; }
}
