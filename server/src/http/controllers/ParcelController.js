import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { NotFoundError } from '../../errors/index.js';

/** Single-parcel operations: an ad-hoc route check, and looking up every decision ever made for a given parcel ID (explainability + the Operations Assistant both use this). */
export class ParcelController {
  #batchService;
  #readModelsFor;
  constructor({ batchService, readModelsFor }) {
    this.#batchService = batchService;
    this.#readModelsFor = readModelsFor;
  }

  buildRouter() {
    const router = Router();

    router.post('/parcels/route', (req, res) => {
      const { parcel, idempotencyKey, policyVersion } = req.body || {};
      const result = this.#batchService.process([parcel], {
        idempotencyKey: idempotencyKey || randomUUID(),
        actor: req.identity.actor,
        role: req.identity.role,
        correlationId: req.correlationId,
        policyVersion,
        source: 'manual'
      });
      res.status(201).json(result);
    });

    router.get('/parcels/:id', (req, res, next) => {
      const decisions = this.#readModelsFor(req.identity).batches.list()
        .flatMap((batch) => batch.results.filter((r) => r.id === req.params.id).map((r) => ({ ...r, batchId: batch.batchId, policyVersion: batch.policyVersion })));
      if (!decisions.length) return next(new NotFoundError(`No decision was found for parcel ${req.params.id}.`));
      res.status(200).json(decisions);
    });

    return router;
  }
}
