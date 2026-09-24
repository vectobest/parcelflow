import { AuthenticationStrategy } from './AuthenticationStrategy.js';
import { AuthenticationError } from '../../errors/index.js';
import { ROLES } from '../roles.js';

/** Local/demo authentication only: trusts X-Role / X-Actor headers. Never enabled when AUTH_MODE=production. */
export class DemoHeaderStrategy extends AuthenticationStrategy {
  supports() { return true; }

  authenticate(request) {
    const role = request.headers['x-role'] || 'OPERATOR';
    const actor = request.headers['x-actor'] || 'demo-operator';
    if (!ROLES.includes(role)) throw new AuthenticationError('Demo role is invalid.');
    return { actor, role, mode: 'demo' };
  }
}
