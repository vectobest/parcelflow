import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';
import { ROLES } from '../../auth/roles.js';
import { requireAuth } from '../middleware/identity.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

/**
 * Real Google OAuth when GOOGLE_CLIENT_ID/SECRET are configured (see
 * docs/decisions/ADR-006); otherwise the /dev-login route stands in so
 * the app stays runnable. /dev-login refuses to run at all once OAuth is
 * configured -- it would otherwise be a trivial account-takeover backdoor
 * (pick any email, get any role) on a real deployment.
 */
export class AuthController {
  #passport;
  #config;
  #userStore;
  #authorizationService;
  #auditService;

  constructor({ passport, config, userStore, authorizationService, auditService }) {
    this.#passport = passport;
    this.#config = config;
    this.#userStore = userStore;
    this.#authorizationService = authorizationService;
    this.#auditService = auditService;
  }

  buildRouter() {
    const router = Router();
    // Only the routes that actually perform a sign-in attempt (brute-forceable) get the
    // strict limiter -- GET /auth/me is a routine identity check fired on every page load
    // and must not share that budget, or normal use (reloads, retries) locks itself out.
    const signInLimiter = authRateLimiter();

    router.get('/auth/status', (_req, res) => res.status(200).json({ oauthEnabled: this.#config.oauthEnabled }));

    router.get('/auth/google', signInLimiter, (req, res, next) => {
      if (!this.#config.oauthEnabled) return next(new ValidationError('Google OAuth is not configured on this server.'));
      this.#passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
    });

    router.get('/auth/google/callback', signInLimiter, (req, res, next) => {
      if (!this.#config.oauthEnabled) return next(new ValidationError('Google OAuth is not configured on this server.'));
      this.#passport.authenticate('google', { failureRedirect: `${this.#config.clientOrigin}/login?error=oauth_failed` })(req, res, () => {
        this.#auditService.record({ action: 'login', entity: 'user', entityId: req.user.email, actor: req.user.email, correlationId: req.correlationId, newValue: { provider: 'google' } });
        res.redirect(this.#config.clientOrigin);
      });
    });

    router.post('/auth/dev-login', signInLimiter, (req, res, next) => {
      if (this.#config.oauthEnabled) return next(new ValidationError('Local dev sign-in is disabled while Google OAuth is configured.'));
      const { email, name, role } = req.body || {};
      if (!email || typeof email !== 'string' || !email.includes('@')) return next(new ValidationError('A valid email is required.'));
      if (role && !ROLES.includes(role)) return next(new ValidationError(`Role must be one of ${ROLES.join(', ')}.`));
      const user = this.#userStore.findOrCreate({ email, name: name || email.split('@')[0], avatarUrl: null, provider: 'dev' });
      const finalUser = role ? this.#userStore.setRole(email, role) : user;
      req.login(finalUser, (error) => {
        if (error) return next(error);
        this.#auditService.record({ action: 'login', entity: 'user', entityId: finalUser.email, actor: finalUser.email, correlationId: req.correlationId, newValue: { provider: 'dev' } });
        res.status(200).json(finalUser);
      });
    });

    router.post('/auth/logout', (req, res, next) => {
      const actor = req.user?.email;
      req.logout((error) => {
        if (error) return next(error);
        if (actor) this.#auditService.record({ action: 'logout', entity: 'user', entityId: actor, actor, correlationId: req.correlationId });
        req.session?.destroy(() => res.status(200).json({ ok: true }));
      });
    });

    router.get('/auth/me', (req, res) => res.status(200).json(req.identity ? { ...req.identity, oauthEnabled: this.#config.oauthEnabled } : { oauthEnabled: this.#config.oauthEnabled }));

    router.get('/auth/users', requireAuth(), (req, res, next) => {
      try {
        this.#authorizationService.assertPermission(req.identity.role, 'manageUsers');
        res.status(200).json(this.#userStore.list());
      } catch (error) { next(error); }
    });

    router.post('/auth/users/:email/role', requireAuth(), (req, res, next) => {
      try {
        this.#authorizationService.assertPermission(req.identity.role, 'manageUsers');
        const { role } = req.body || {};
        if (!ROLES.includes(role)) throw new ValidationError(`Role must be one of ${ROLES.join(', ')}.`);
        const updated = this.#userStore.setRole(req.params.email, role);
        if (!updated) throw new ValidationError('User was not found.');
        this.#auditService.record({ action: 'permission_changed', entity: 'user', entityId: updated.email, actor: req.identity.actor, correlationId: req.correlationId, newValue: role });
        res.status(200).json(updated);
      } catch (error) { next(error); }
    });

    // Assign a role to an email that hasn't signed in yet -- applied automatically the
    // moment that email actually signs in, instead of that person defaulting to OPERATOR.
    router.get('/auth/pending-roles', requireAuth(), (req, res, next) => {
      try {
        this.#authorizationService.assertPermission(req.identity.role, 'manageUsers');
        res.status(200).json(this.#userStore.listPendingRoles());
      } catch (error) { next(error); }
    });

    router.post('/auth/pending-roles', requireAuth(), (req, res, next) => {
      try {
        this.#authorizationService.assertPermission(req.identity.role, 'manageUsers');
        const { email, role } = req.body || {};
        if (!email || typeof email !== 'string' || !email.includes('@')) throw new ValidationError('A valid email is required.');
        if (!ROLES.includes(role)) throw new ValidationError(`Role must be one of ${ROLES.join(', ')}.`);
        if (this.#userStore.get(email)) throw new ValidationError('That email has already signed in -- change their role directly instead.');
        const preset = this.#userStore.presetRole(email, role);
        this.#auditService.record({ action: 'role_preassigned', entity: 'user', entityId: preset.email, actor: req.identity.actor, correlationId: req.correlationId, newValue: role });
        res.status(200).json(preset);
      } catch (error) { next(error); }
    });

    router.delete('/auth/pending-roles/:email', requireAuth(), (req, res, next) => {
      try {
        this.#authorizationService.assertPermission(req.identity.role, 'manageUsers');
        const removed = this.#userStore.removePendingRole(req.params.email);
        if (!removed) throw new ValidationError('No pending role assignment for that email.');
        this.#auditService.record({ action: 'role_preassignment_removed', entity: 'user', entityId: req.params.email.toLowerCase(), actor: req.identity.actor, correlationId: req.correlationId });
        res.status(200).json({ ok: true });
      } catch (error) { next(error); }
    });

    return router;
  }
}
