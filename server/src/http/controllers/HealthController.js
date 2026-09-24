import { Router } from 'express';

export class HealthController {
  #startedAt = Date.now();
  #policyService;
  #config;

  constructor({ policyService, config }) {
    this.#policyService = policyService;
    this.#config = config;
  }

  buildRouter() {
    const router = Router();
    router.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor((Date.now() - this.#startedAt) / 1000), activePolicy: this.#policyService.activeVersion(), oauthEnabled: this.#config.oauthEnabled, aiEnabled: this.#config.aiEnabled });
    });
    router.get('/health/ready', (_req, res) => res.status(200).json({ ready: true }));
    return router;
  }
}
