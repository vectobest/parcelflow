import { Router } from 'express';

export class RiskController {
  #riskService;
  constructor({ riskService }) { this.#riskService = riskService; }

  buildRouter() {
    const router = Router();
    router.get('/risk', (req, res) => res.status(200).json(this.#riskService.assess()));
    return router;
  }
}
