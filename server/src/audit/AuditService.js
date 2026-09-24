import { randomUUID } from 'node:crypto';

/**
 * Append-only audit trail: who did what, when, and what changed --
 * required for incident investigation (master prompt section 30). Every
 * important state-changing action in the system calls this.
 */
export class AuditService {
  #repository;
  #clock;

  constructor({ repository, clock = () => new Date() }) {
    this.#repository = repository;
    this.#clock = clock;
  }

  record({ action, entity = null, entityId = null, actor = 'system', correlationId = null, previousValue = null, newValue = null, result = 'SUCCESS', metadata = null }) {
    return this.#repository.add({
      eventId: randomUUID(),
      timestamp: this.#clock().toISOString(),
      actor,
      action,
      entity,
      entityId,
      previousValue,
      newValue,
      result,
      metadata,
      correlationId
    });
  }

  list() { return this.#repository.list(); }
}
