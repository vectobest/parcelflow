import { AppError } from './AppError.js';

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, { statusCode: 401, code: 'AUTHENTICATION_REQUIRED' });
  }
}
