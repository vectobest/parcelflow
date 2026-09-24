import rateLimit from 'express-rate-limit';

/** Rate limiting is a basic defence against brute force and rate abuse (master prompt section 7). */
export function apiRateLimiter(config) {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again shortly.' }
  });
}

/** Stricter limit on auth endpoints specifically, since they are the most valuable brute-force target. */
export function authRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please try again later.' }
  });
}
