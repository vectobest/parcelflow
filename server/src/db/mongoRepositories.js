import { MongoClient } from 'mongodb';
import { MongoBackedMap } from './MongoBackedMap.js';
import { PolicyRepository } from '../policies/PolicyRepository.js';
import { AuditRepository } from '../audit/AuditRepository.js';
import { ApprovalRepository } from '../approvals/ApprovalRepository.js';
import { BatchRepository } from '../batches/BatchRepository.js';

/**
 * Every repository below is a thin adapter over a MongoBackedMap, matching the
 * exact shape of its InMemory counterpart (see each domain's InMemory___Repository.js) --
 * so PolicyService, AuditService, ApprovalService, BatchService and
 * IncidentDetectorService never know or care whether they were handed one of
 * these or the plain in-memory version.
 */
class MongoPolicyRepository extends PolicyRepository {
  #map;
  constructor(map) { super(); this.#map = map; }
  get(version) { return this.#map.get(version); }
  list() { return [...this.#map.values()]; }
  save(policy) { this.#map.set(policy.version, policy); return policy; }
  has(version) { return this.#map.has(version); }
}

class MongoApprovalRepository extends ApprovalRepository {
  #map;
  constructor(map) { super(); this.#map = map; }
  get(id) { return this.#map.get(id); }
  list() { return [...this.#map.values()]; }
  save(approval) { this.#map.set(approval.approvalId, approval); return approval; }
}

class MongoBatchRepository extends BatchRepository {
  #map;
  constructor(map) { super(); this.#map = map; }
  save(record) { this.#map.set(record.batchId, record); return record; }
  list() { return [...this.#map.values()]; }
}

/** No abstract base exists for this one in-memory today (see InMemoryIncidentRepository.js); matched as-is. */
class MongoIncidentRepository {
  #map;
  constructor(map) { this.#map = map; }
  get(id) { return this.#map.get(id); }
  list() { return [...this.#map.values()]; }
  save(incident) { this.#map.set(incident.incidentId, incident); return incident; }
}

class MongoAuditRepository extends AuditRepository {
  #map;
  constructor(map) { super(); this.#map = map; }
  // Append-only: this class has no update or delete method, same guarantee as InMemoryAuditRepository.
  add(entry) { const frozen = Object.freeze(entry); this.#map.set(entry.eventId, frozen); return entry; }
  // Hydration order from Mongo isn't guaranteed to be insertion order, so sort by the timestamp every entry carries.
  list() { return [...this.#map.values()].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); }
}

/**
 * Connects to MongoDB, loads every collection into memory, and returns
 * repository instances ready to hand to createContainer(). Called once at
 * boot, only when MONGODB_URI is set (see server.js and docs/decisions/ADR-010) --
 * every other path (all 96 server tests, and any deployment without a
 * database configured) never touches this file and keeps working exactly as
 * before, entirely in memory.
 */
export async function connectMongoRepositories({ config, logger }) {
  const client = new MongoClient(config.mongoUri);
  await client.connect();
  const db = client.db(config.mongoDbName);

  const maps = {
    policies: new MongoBackedMap({ collection: db.collection('policies'), logger }),
    audit: new MongoBackedMap({ collection: db.collection('auditEvents'), logger }),
    approvals: new MongoBackedMap({ collection: db.collection('approvals'), logger }),
    batches: new MongoBackedMap({ collection: db.collection('batches'), logger }),
    incidents: new MongoBackedMap({ collection: db.collection('incidents'), logger }),
    users: new MongoBackedMap({ collection: db.collection('users'), logger }),
    pendingRoles: new MongoBackedMap({ collection: db.collection('pendingRoles'), logger })
  };
  await Promise.all(Object.values(maps).map((map) => map.hydrate()));

  return {
    policyRepository: new MongoPolicyRepository(maps.policies),
    auditRepository: new MongoAuditRepository(maps.audit),
    approvalRepository: new MongoApprovalRepository(maps.approvals),
    batchRepository: new MongoBatchRepository(maps.batches),
    incidentRepository: new MongoIncidentRepository(maps.incidents),
    userStoreMaps: { users: maps.users, pendingRoles: maps.pendingRoles },
    counts: Object.fromEntries(Object.entries(maps).map(([name, map]) => [name, [...map.values()].length])),
    close: () => client.close()
  };
}
