import { Router } from 'express';

/** Policy simulation ("what-if") and historical decision replay (master prompt sections 17, 24). Both are read-only and share the exact RoutingEngine used in production. */
export class AnalysisController {
  #comparisonService;
  constructor({ comparisonService }) { this.#comparisonService = comparisonService; }

  buildRouter() {
    const router = Router();
    router.post('/simulate', (req, res) => res.status(200).json(this.#comparisonService.simulate(req.body?.parcels, req.body?.candidatePolicyVersion)));
    router.post('/replay', (req, res) => res.status(200).json(this.#comparisonService.replay(req.body?.batchId, req.body?.policyVersion)));
    return router;
  }
}
