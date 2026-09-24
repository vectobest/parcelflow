import { PolicyRepository } from './PolicyRepository.js';

/** In-memory implementation, swappable for a database-backed one without changing PolicyService. */
export class InMemoryPolicyRepository extends PolicyRepository {
  #policies = new Map();

  get(version) { return this.#policies.get(version); }
  list() { return [...this.#policies.values()]; }
  save(policy) { this.#policies.set(policy.version, policy); return policy; }
  has(version) { return this.#policies.has(version); }
}
