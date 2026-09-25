import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';

/** Time Machine: point-in-time system state reconstructed from recorded events (master prompt section 23). */
export class HistoryController {
  #readModelsFor;
  constructor({ readModelsFor }) { this.#readModelsFor = readModelsFor; }

  buildRouter() {
    const router = Router();
    router.get('/history/timeline', (req, res) => res.status(200).json(this.#readModelsFor(req.identity).systemHistoryService.timeline()));
    router.get('/history/state', (req, res, next) => {
      if (!req.query.at) return next(new ValidationError('A "at" ISO timestamp query parameter is required.'));
      try {
        res.status(200).json(this.#readModelsFor(req.identity).systemHistoryService.stateAt(req.query.at));
      } catch {
        next(new ValidationError('The "at" parameter must be a valid ISO timestamp.'));
      }
    });
    return router;
  }
}
