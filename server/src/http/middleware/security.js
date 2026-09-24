import helmet from 'helmet';

/** Baseline hardening headers for a public-internet-facing API (master prompt section 5/7). */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'none'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' }
  });
}
