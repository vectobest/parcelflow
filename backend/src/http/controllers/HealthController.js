import { Router } from 'express';

/** Liveness/readiness probes -- unauthenticated by design, outside /api, so an orchestrator can call them without credentials. */
export class HealthController {
  #policyService;
  #startedAt;
  #version;

  constructor({ policyService, startedAt = Date.now(), version = '1.0.0' }) {
    this.#policyService = policyService;
    this.#startedAt = startedAt;
    this.#version = version;
  }

  buildRouter() {
    const router = Router();
    router.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', version: this.#version, uptime: Math.floor((Date.now() - this.#startedAt) / 1000) });
    });
    router.get('/ready', (req, res) => {
      res.status(200).json({ status: 'ready', policy: this.#policyService.activeVersion(), components: { routing: 'ready', policyStore: 'ready', audit: 'ready' } });
    });
    return router;
  }
}
