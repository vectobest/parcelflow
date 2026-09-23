export function createIdempotencyStore() {
  const completed = new Map();
  const inFlight = new Set();

  function begin(key) {
    if (completed.has(key)) return { state: 'completed', value: completed.get(key) };
    if (inFlight.has(key)) return { state: 'in-flight' };
    inFlight.add(key);
    return { state: 'reserved' };
  }

  function complete(key, value) {
    inFlight.delete(key);
    completed.set(key, value);
  }

  function release(key) {
    inFlight.delete(key);
  }

  return { begin, complete, release, size: () => completed.size };
}