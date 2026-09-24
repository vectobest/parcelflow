import { AppError } from '../../errors/index.js';

/**
 * Single place that turns any thrown error into an HTTP response. Custom
 * error classes carry their own statusCode/code (see errors/), so this
 * never has to pattern-match on error message text. Unexpected (5xx)
 * errors are logged with full detail server-side but never leak their raw
 * message to the client.
 */
export function errorHandler(logger) {
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    const isAppError = error instanceof AppError;
    const statusCode = isAppError ? error.statusCode : (error instanceof SyntaxError ? 400 : 500);
    const code = isAppError ? error.code : (statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');
    const correlationId = req.correlationId;

    if (statusCode === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="parcel-routing-control-room"');

    if (statusCode >= 500) {
      logger.error('request_failed', { correlationId, path: req.path, method: req.method, error: error.message, stack: error.stack });
    } else {
      logger.warn('request_rejected', { correlationId, path: req.path, method: req.method, statusCode, error: error.message });
    }

    res.status(statusCode).json({
      error: statusCode >= 500 ? 'Internal server error.' : error.message,
      code,
      correlationId,
      ...(isAppError && error.details ? { details: error.details } : {})
    });
  };
}
