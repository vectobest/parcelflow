export function requestLogger(logger) {
  return (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      logger.info('http_request', { method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt, correlationId: req.correlationId, actor: req.user?.email || 'anonymous' });
    });
    next();
  };
}
