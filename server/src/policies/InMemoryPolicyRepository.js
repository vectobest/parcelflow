import { PolicyRepository } from './PolicyRepository.js';

/** In-memory implementation. Swappable for a database-backed one without changing PolicyService (see docs/decisions/ADR-007 for why this app stays in-memory). */
export class InMemoryPolicyRepository extends PolicyRepository {
  #policies = new Map();

  get(version) { return this.#policies.get(version); }
  list() { return [...this.#policies.values()]; }
  save(policy) { this.#policies.set(policy.version, policy); return policy; }
  has(version) { return this.#policies.has(version); }
}
