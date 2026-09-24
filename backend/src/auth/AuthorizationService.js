import { AuthorizationError } from '../errors/index.js';

const PERMISSIONS = Object.freeze({
  process: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  retry: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  approve: ['REVIEWER', 'ADMIN']
});

/** Centralises the role -> permission map (RBAC). Adding a permission means adding one entry here, not scattering `if (role === ...)` checks. */
export class AuthorizationService {
  assertPermission(role, permission) {
    if (!PERMISSIONS[permission]?.includes(role)) {
      throw new AuthorizationError(`Role ${role} cannot perform ${permission}.`);
    }
  }

  assertRole(role, allowedRoles, message) {
    if (!allowedRoles.includes(role)) {
      throw new AuthorizationError(message || `Role ${role} is not authorized to perform this action.`);
    }
  }
}
