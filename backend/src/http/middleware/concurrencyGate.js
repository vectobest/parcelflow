/** Wraps the whole downstream chain in an AsyncGate slot so the number of requests being actively processed never exceeds the configured concurrency, even though Express itself has no such limit. */
export function concurrencyGate(gate) {
  return (req, res, next) => {
    gate.run(() => new Promise((resolve, reject) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      res.once('error', reject);
      try {
        next();
      } catch (error) {
        reject(error);
      }
    })).catch((error) => {
      if (!res.headersSent) next(error);
    });
  };
}
