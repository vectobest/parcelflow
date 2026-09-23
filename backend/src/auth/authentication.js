import { timingSafeEqual } from 'node:crypto';
import { ROLES } from './authorization.js';

export class AuthenticationError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function configuredTokens(rawTokens = '') {
  return rawTokens.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [token, actor, role] = entry.split(':');
    if (!token || !actor || !ROLES.includes(role)) return null;
    return { token, actor, role };
  }).filter(Boolean);
}

export function createAuthenticator({ mode = process.env.AUTH_MODE || 'demo', tokens = process.env.AUTH_TOKENS || '' } = {}) {
  const credentials = configuredTokens(tokens);

  function authenticate(request) {
    const authorization = request.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      const presented = authorization.slice('Bearer '.length).trim();
      const identity = credentials.find(({ token }) => safeEqual(token, presented));
      if (!identity) throw new AuthenticationError('Bearer token is invalid.');
      return { actor: identity.actor, role: identity.role, mode: 'bearer' };
    }

    if (mode === 'demo') {
      const role = request.headers['x-role'] || 'OPERATOR';
      const actor = request.headers['x-actor'] || 'demo-operator';
      if (!ROLES.includes(role)) throw new AuthenticationError('Demo role is invalid.');
      return { actor, role, mode: 'demo' };
    }

    throw new AuthenticationError('Bearer authentication is required.');
  }

  return { authenticate, mode, configuredCredentialCount: credentials.length };
}