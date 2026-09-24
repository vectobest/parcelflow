import helmet from 'helmet';

/** Security headers (CSP, no-sniff, no referrer, hidden framework fingerprint, ...). Hardens against XSS/clickjacking/MIME-sniffing, appropriate for an app facing the public internet. */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'none'"] }
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-origin' }
  });
}

/** API responses must never be cached by an intermediary (routing decisions are per-request and audit-sensitive). Static assets are exempt so the browser can cache CSS/JS normally. */
export function noStoreForApi() {
  return (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
