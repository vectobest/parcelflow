import { Router } from 'express';
import { randomUUID } from 'node:crypto';

export class ParcelController {
  #batchService;
  constructor({ batchService }) { this.#batchService = batchService; }

  buildRouter() {
    const router = Router();
    router.post('/parcels/route', (req, res) => {
      const { parcel, idempotencyKey } = req.body;
      const result = this.#batchService.process([parcel], {
        idempotencyKey: idempotencyKey || randomUUID(),
        actor: req.identity.actor,
        role: req.identity.role,
        correlationId: req.correlationId
      });
      res.status(201).json(result);
    });
    return router;
  }
}
