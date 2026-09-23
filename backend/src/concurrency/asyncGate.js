export function createAsyncGate({ limit = 4 } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Concurrency limit must be a positive integer.');
  let active = 0;
  const waiters = [];

  function drain() {
    while (active < limit && waiters.length) {
      active += 1;
      waiters.shift()();
    }
  }

  async function run(task) {
    await new Promise((resolve) => {
      waiters.push(resolve);
      drain();
    });
    try {
      return await task();
    } finally {
      active -= 1;
      drain();
    }
  }

  return { run, active: () => active, queued: () => waiters.length, limit };
}