import rateLimit from 'express-rate-limit';

/** Per-IP request cap for the API surface -- a baseline defence against brute-forcing tokens and basic denial-of-service traffic once this is public-facing. */
export function apiRateLimiter({ windowMs, max }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.' }
  });
}
