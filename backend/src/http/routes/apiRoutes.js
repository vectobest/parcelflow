import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { concurrencyGate } from '../middleware/concurrencyGate.js';
import { noStoreForApi } from '../middleware/security.js';
import { notFoundHandler } from '../middleware/notFoundHandler.js';

/**
 * Composition point for the whole /api surface: rate limit -> concurrency
 * gate -> authenticate -> each controller's own router -> 404 fallback.
 * Controllers are handed in from the composition root (container.js), so
 * adding a new resource means adding one controller to the array below --
 * nothing here has to change to support it.
 */
export function buildApiRouter({ controllers, authenticationService, requestGate, rateLimiter }) {
  const router = Router();
  if (rateLimiter) router.use(rateLimiter);
  router.use(noStoreForApi());
  if (requestGate) router.use(concurrencyGate(requestGate));
  router.use(authenticate(authenticationService));
  for (const controller of controllers) router.use(controller.buildRouter());
  router.use(notFoundHandler('API route not found.'));
  return router;
}
