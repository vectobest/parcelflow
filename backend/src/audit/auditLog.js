import { randomUUID } from 'node:crypto';

export function createAuditLog({ clock = () => new Date() } = {}) {
  const records = [];

  function record(action, entityId, actor, correlationId, previousValue = null, newValue = null) {
    const entry = { eventId: randomUUID(), timestamp: clock().toISOString(), actor, action, entityId, previousValue, newValue, correlationId };
    records.push(entry);
    return entry;
  }

  return { record, list: () => [...records] };
}