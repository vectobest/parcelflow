import { randomUUID } from 'node:crypto';

/** Every request gets a correlation ID -- supplied by the client or generated here -- that flows through routing, audit and error responses (master prompt section 31). */
export function correlationId() {
  return (req, res, next) => {
    req.correlationId = req.get('X-Correlation-ID') || randomUUID();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  };
}
