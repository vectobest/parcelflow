import { AuthenticationError } from '../../errors/index.js';

/**
 * Resolves `req.identity` from either the Passport session (interactive
 * browser sign-in) or a bearer token (machine callers) -- see
 * server/src/auth. Every controller reads `req.identity`, never `req.user`
 * or the raw headers directly, so authentication is checked in exactly
 * one place.
 */
export function attachIdentity(authenticationService) {
  return (req, _res, next) => {
    if (req.isAuthenticated?.()) {
      req.identity = { actor: req.user.email, role: req.user.role, name: req.user.name };
      return next();
    }
    if (req.headers.authorization) {
      try {
        const { actor, role } = authenticationService.authenticate(req);
        req.identity = { actor, role, name: actor };
      } catch {
        req.identity = null;
      }
    } else {
      req.identity = null;
    }
    next();
  };
}

export function requireAuth() {
  return (req, _res, next) => {
    if (!req.identity) return next(new AuthenticationError('Sign in to continue.'));
    next();
  };
}
