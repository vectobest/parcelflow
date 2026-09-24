import { Router } from 'express';
import { NotFoundError } from '../../errors/index.js';

export class BatchController {
  #batchService;
  #comparisonService;

  constructor({ batchService, comparisonService }) {
    this.#batchService = batchService;
    this.#comparisonService = comparisonService;
  }

  buildRouter() {
    const router = Router();

    router.post('/batches', (req, res) => {
      const { parcels, idempotencyKey, policyVersion } = req.body;
      const result = this.#batchService.process(parcels, {
        idempotencyKey,
        actor: req.identity.actor,
        role: req.identity.role,
        correlationId: req.correlationId,
        policyVersion
      });
      res.status(201).json(result);
    });

    router.get('/batches/:id', (req, res) => {
      const batch = this.#batchService.get(req.params.id);
      if (!batch) throw new NotFoundError('Batch was not found.');
      res.status(200).json(batch);
    });

    router.post('/retry', (req, res) => {
      const result = this.#batchService.retry(req.body.batchId, { actor: req.identity.actor, role: req.identity.role });
      res.status(200).json(result);
    });

    router.post('/simulate', (req, res) => {
      const result = this.#comparisonService.simulate(req.body.parcels, req.body.candidatePolicyVersion);
      res.status(200).json(result);
    });

    router.post('/replay', (req, res) => {
      const result = this.#comparisonService.replay(req.body.batchId, req.body.policyVersion);
      res.status(200).json(result);
    });

    return router;
  }
}
