/** Resolves req.identity ({ actor, role, mode }) via the injected AuthenticationService, or forwards an AuthenticationError to the central error handler. */
export function authenticate(authenticationService) {
  return (req, res, next) => {
    try {
      req.identity = authenticationService.authenticate(req);
      next();
    } catch (error) {
      next(error);
    }
  };
}
