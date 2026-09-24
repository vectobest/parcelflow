import { randomUUID } from 'node:crypto';

/** Append-only audit trail: who did what, when, and what changed -- required for incident investigation. */
export class AuditService {
  #repository;
  #clock;

  constructor({ repository, clock = () => new Date() }) {
    this.#repository = repository;
    this.#clock = clock;
  }

  record(action, entityId, actor, correlationId, previousValue = null, newValue = null) {
    return this.#repository.add({
      eventId: randomUUID(),
      timestamp: this.#clock().toISOString(),
      actor,
      action,
      entityId,
      previousValue,
      newValue,
      correlationId
    });
  }

  list() { return this.#repository.list(); }
}
