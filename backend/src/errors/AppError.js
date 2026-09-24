/**
 * Base class for all application errors. Every error carries an HTTP status
 * code and a machine-readable code so the HTTP layer never has to guess a
 * status from a message string (the previous implementation matched error
 * messages against a regular expression, which is brittle and easy to break
 * silently when a message is reworded).
 */
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
  }
}
