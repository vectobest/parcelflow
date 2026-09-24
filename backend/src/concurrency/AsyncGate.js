/**
 * Bounds how many requests are processed concurrently, protecting the
 * process from being overwhelmed (part of the public-internet threat model:
 * a basic defence against resource-exhaustion / slow-client abuse).
 */
export class AsyncGate {
  #limit;
  #active = 0;
  #waiters = [];

  constructor({ limit = 4 } = {}) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency limit must be a positive integer.');
    this.#limit = limit;
  }

  #drain() {
    while (this.#active < this.#limit && this.#waiters.length) {
      this.#active += 1;
      this.#waiters.shift()();
    }
  }

  async run(task) {
    await new Promise((resolve) => {
      this.#waiters.push(resolve);
      this.#drain();
    });
    try {
      return await task();
    } finally {
      this.#active -= 1;
      this.#drain();
    }
  }

  active() { return this.#active; }
  queued() { return this.#waiters.length; }
  get limit() { return this.#limit; }
}
