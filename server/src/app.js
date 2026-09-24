import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { securityHeaders } from './http/middleware/security.js';
import { correlationId } from './http/middleware/correlationId.js';
import { requestLogger } from './http/middleware/requestLogger.js';
import { apiRateLimiter, authRateLimiter } from './http/middleware/rateLimiter.js';
import { concurrencyGate } from './http/middleware/concurrencyGate.js';
import { attachIdentity } from './http/middleware/identity.js';
import { errorHandler } from './http/middleware/errorHandler.js';
import { notFoundHandler } from './http/middleware/notFoundHandler.js';
import { buildApiRouter } from './http/routes/apiRoutes.js';

/**
 * Assembles the Express app from a pre-built container (see container.js).
 * Middleware order matters and is deliberate: security headers and CORS
 * first, then correlation ID (so every later log line and error response
 * can carry it), then the concurrency gate and rate limiter (reject
 * overload before doing any real work), then session/auth, then routes,
 * then the error handler last so it can catch anything above it.
 */
export function createApp(container) {
  const { config, logger } = container;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeaders());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(correlationId());
  app.use(requestLogger(logger));
  app.use(concurrencyGate(container.requestGate));
  app.use(express.json({ limit: `${Math.ceil(config.maxUploadBytes / (1024 * 1024)) + 1}mb` }));

  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: config.nodeEnv === 'production', maxAge: 8 * 60 * 60 * 1000 }
  }));
  app.use(container.passport.initialize());
  app.use(container.passport.session());
  app.use(attachIdentity(container.authenticationService));

  app.use('/api/auth', authRateLimiter());
  app.use('/api', apiRateLimiter(config));
  app.use('/api', buildApiRouter(container));

  app.use(notFoundHandler());
  app.use(errorHandler(logger));

  return app;
}
