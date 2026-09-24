import { BatchRepository } from './BatchRepository.js';

export class InMemoryBatchRepository extends BatchRepository {
  #batches = new Map();
  save(record) { this.#batches.set(record.batchId, record); return record; }
  list() { return [...this.#batches.values()]; }
}
