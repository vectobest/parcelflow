import { randomUUID } from 'node:crypto';

/** Every request gets a correlation id (caller-supplied or generated), echoed back on the response so a client-reported issue can be traced through the logs and audit log. */
export function correlationId() {
  return (req, res, next) => {
    const id = req.headers['x-correlation-id'] || randomUUID();
    req.correlationId = id;
    res.setHeader('X-Correlation-ID', id);
    next();
  };
}
