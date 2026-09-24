import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';
import { ChaosDrillService } from '../../drills/ChaosDrillService.js';

/** Admin-only chaos and security drills (master prompt sections 21, 22). Simulation only -- never touches real batches, policies or approvals. */
export class DrillController {
  #chaosDrillService;
  #securityDrillService;
  #authorizationService;

  constructor({ chaosDrillService, securityDrillService, authorizationService }) {
    this.#chaosDrillService = chaosDrillService;
    this.#securityDrillService = securityDrillService;
    this.#authorizationService = authorizationService;
  }

  buildRouter() {
    const router = Router();

    router.get('/drills/chaos/scenarios', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'runDrill');
      res.status(200).json(ChaosDrillService.scenarios);
    });

    router.post('/drills/chaos/:scenario', (req, res, next) => {
      this.#authorizationService.assertPermission(req.identity.role, 'runDrill');
      if (!ChaosDrillService.scenarios[req.params.scenario]) return next(new ValidationError(`Unknown chaos scenario "${req.params.scenario}".`));
      res.status(200).json(this.#chaosDrillService.run(req.params.scenario, { actor: req.identity.actor }));
    });

    router.post('/drills/security', (req, res) => {
      this.#authorizationService.assertPermission(req.identity.role, 'runDrill');
      res.status(200).json(this.#securityDrillService.runAll({ actor: req.identity.actor }));
    });

    return router;
  }
}
