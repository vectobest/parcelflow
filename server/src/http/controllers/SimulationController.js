import { Router } from 'express';

/** Digital Twin capacity what-if (master prompt section 17). Read-only; the request body is a scenario, not a mutation. */
export class SimulationController {
  #digitalTwinService;
  constructor({ digitalTwinService }) { this.#digitalTwinService = digitalTwinService; }

  buildRouter() {
    const router = Router();
    router.post('/digital-twin', (req, res) => res.status(200).json(this.#digitalTwinService.run(req.body || {})));
    return router;
  }
}
