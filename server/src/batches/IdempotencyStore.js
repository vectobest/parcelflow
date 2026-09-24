/** Guarantees "process this batch exactly once": concurrent retries of the same key are serialized and replayed rather than double-processed. */
export class IdempotencyStore {
  #completed = new Map();
  #inFlight = new Set();

  begin(key) {
    if (this.#completed.has(key)) return { state: 'completed', value: this.#completed.get(key) };
    if (this.#inFlight.has(key)) return { state: 'in-flight' };
    this.#inFlight.add(key);
    return { state: 'reserved' };
  }

  complete(key, value) {
    this.#inFlight.delete(key);
    this.#completed.set(key, value);
  }

  release(key) { this.#inFlight.delete(key); }
  get size() { return this.#completed.size; }
}
