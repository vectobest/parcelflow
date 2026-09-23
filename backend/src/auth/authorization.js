export const ROLES = Object.freeze(['OPERATOR', 'REVIEWER', 'ADMIN']);

const PERMISSIONS = Object.freeze({
  process: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  retry: ['OPERATOR', 'REVIEWER', 'ADMIN'],
  approve: ['REVIEWER', 'ADMIN']
});

export function assertPermission(role, permission) {
  if (!PERMISSIONS[permission]?.includes(role)) throw new Error(`Role ${role} cannot perform ${permission}.`);
}