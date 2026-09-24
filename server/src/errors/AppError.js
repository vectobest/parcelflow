/** Base class for every error the domain/application layer throws on purpose. Carries an HTTP status so the error handler never has to guess. */
export class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}
