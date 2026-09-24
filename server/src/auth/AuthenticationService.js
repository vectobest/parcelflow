import { timingSafeEqual } from 'node:crypto';
import { AuthenticationError } from '../errors/index.js';
import { ROLES } from './roles.js';

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

/**
 * Bearer-token authentication for machine-to-machine callers (CI, scripts,
 * the security drill) that isn't the browser's interactive Google OAuth
 * session -- see server/src/auth/passport.js for that flow. No tokens are
 * configured by default, so every bearer attempt is rejected until an
 * operator explicitly sets SERVICE_TOKENS.
 */
export class AuthenticationService {
  #credentials;

  constructor({ tokens = '' } = {}) {
    this.#credentials = parseTokens(tokens);
  }

  authenticate(request) {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AuthenticationError('A bearer token is required.');
    const presented = header.slice('Bearer '.length).trim();
    const identity = this.#credentials.find(({ token }) => safeEqual(token, presented));
    if (!identity) throw new AuthenticationError('Bearer token is invalid.');
    return { actor: identity.actor, role: identity.role, mode: 'bearer' };
  }

  get configuredCredentialCount() { return this.#credentials.length; }
}
