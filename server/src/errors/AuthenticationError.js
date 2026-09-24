import { AppError } from './AppError.js';

export class AuthenticationError extends AppError {
  constructor(message) { super(message, 401); }
}
