/** Abstraction PolicyService depends on (DIP). Swappable for a persistent store without touching business logic. */
export class PolicyRepository {
  get(_version) { throw new Error('PolicyRepository.get() must be implemented.'); }
  list() { throw new Error('PolicyRepository.list() must be implemented.'); }
  save(_policy) { throw new Error('PolicyRepository.save() must be implemented.'); }
  has(_version) { throw new Error('PolicyRepository.has() must be implemented.'); }
}
