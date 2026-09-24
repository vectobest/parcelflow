import { AppError } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(message) {
    super(message, { statusCode: 404, code: 'NOT_FOUND' });
  }
}
