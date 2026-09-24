import { AppError } from './AppError.js';

export class AuthorizationError extends AppError {
  constructor(message = 'You are not authorized to perform this action.') {
    super(message, { statusCode: 403, code: 'FORBIDDEN' });
  }
}
