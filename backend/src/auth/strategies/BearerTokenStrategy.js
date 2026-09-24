import { timingSafeEqual } from 'node:crypto';
import { AuthenticationStrategy } from './AuthenticationStrategy.js';
import { AuthenticationError } from '../../errors/index.js';
import { ROLES } from '../roles.js';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseTokens(raw) {
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [token, actor, role] = entry.split(':');
    if (!token || !actor || !ROLES.includes(role)) return null;
    return { token, actor, role };
  }).filter(Boolean);
}

/** Production authentication: a Bearer token maps to a configured (actor, role) pair via constant-time comparison. */
export class BearerTokenStrategy extends AuthenticationStrategy {
  #credentials;

  constructor(tokensConfig = '') {
    super();
    this.#credentials = parseTokens(tokensConfig);
  }

  supports(request) {
    return Boolean(request.headers.authorization?.startsWith('Bearer '));
  }

  authenticate(request) {
    const presented = request.headers.authorization.slice('Bearer '.length).trim();
    const identity = this.#credentials.find(({ token }) => safeEqual(token, presented));
    if (!identity) throw new AuthenticationError('Bearer token is invalid.');
    return { actor: identity.actor, role: identity.role, mode: 'bearer' };
  }

  get configuredCredentialCount() { return this.#credentials.length; }
}
