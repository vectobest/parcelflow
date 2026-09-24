import { AppError } from './AppError.js';

export class AuthorizationError extends AppError {
  constructor(message) { super(message, 403); }
}
