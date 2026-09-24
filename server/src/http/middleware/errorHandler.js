import { AppError } from '../../errors/index.js';

/**
 * Single place that turns any thrown error into an HTTP response. Known
 * AppError subclasses map to their own status and a safe message; anything
 * else is logged with full detail server-side but the client only ever
 * sees a generic message and a correlation ID to hand to support -- never
 * a stack trace (master prompt: "expose stack traces to users" is an
 * explicit anti-pattern).
 */
export function errorHandler(logger) {
  return (error, req, res, _next) => {
    const isKnown = error instanceof AppError;
    const status = isKnown ? error.status : 500;
    if (!isKnown) logger.error('unhandled_error', { message: error.message, stack: error.stack, correlationId: req.correlationId });
    res.status(status).json({
      error: isKnown ? error.message : 'Something went wrong on our side. No changes were made.',
      correlationId: req.correlationId
    });
  };
}
