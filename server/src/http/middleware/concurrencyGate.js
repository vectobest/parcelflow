/** Bounds in-flight request processing (see AsyncGate) so a burst of slow requests can't exhaust the process. */
export function concurrencyGate(gate) {
  return (req, res, next) => {
    gate.run(() => new Promise((resolve) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      next();
    })).catch(next);
  };
}
