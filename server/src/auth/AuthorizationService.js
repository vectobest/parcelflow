import { AuthorizationError } from '../errors/index.js';

const PERMISSIONS = Object.freeze({
  process: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  retry: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  approve: ['REVIEWER', 'ADMIN'],
  // Operators only see what they submitted; reviewers need everyone's parcels to approve them.
  viewAllOperations: ['REVIEWER', 'ADMIN'],
  managePolicy: ['ADMIN'],
  runDrill: ['ADMIN'],
  viewAudit: ['ADMIN'],
  manageUsers: ['ADMIN']
});

/** Centralises the role -> permission map (RBAC, master prompt section 10). Adding a permission means adding one entry here, not scattering `if (role === ...)` checks. Enforced server-side only -- the client never gets to decide what it's allowed to do. */
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

  can(role, permission) {
    return Boolean(PERMISSIONS[permission]?.includes(role));
  }
}
