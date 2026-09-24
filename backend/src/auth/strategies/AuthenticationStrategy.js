/** Strategy interface (OCP): adding a new auth method, e.g. an OAuth/OIDC strategy, never touches AuthenticationService. */
export class AuthenticationStrategy {
  supports(_request) { throw new Error('AuthenticationStrategy.supports() must be implemented.'); }
  authenticate(_request) { throw new Error('AuthenticationStrategy.authenticate() must be implemented.'); }
}
