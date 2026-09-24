import { Router } from 'express';
import { NotFoundError, ValidationError } from '../../errors/index.js';

/**
 * Batch intake and management. Uploaded file content arrives as a JSON
 * field (`{ content, format }`) rather than multipart/form-data -- the
 * browser reads the File object as text and posts it, so the server never
 * has to trust a client-supplied filename or MIME type, only the bytes
 * (master prompt section 9: "avoid trusting filenames").
 */
export class BatchController {
  #batchService;
  #secureBatchParser;
  #incidentDetectorService;
  #retryService;

  constructor({ batchService, secureBatchParser, incidentDetectorService, retryService }) {
    this.#batchService = batchService;
    this.#secureBatchParser = secureBatchParser;
    this.#incidentDetectorService = incidentDetectorService;
    this.#retryService = retryService;
  }

  buildRouter() {
    const router = Router();

    router.post('/batches', (req, res) => {
      const { parcels, idempotencyKey, policyVersion } = req.body || {};
      const batch = this.#processAndDetect(parcels, { idempotencyKey, policyVersion, req, source: 'manual' });
      res.status(201).json(batch);
    });

    router.post('/batches/upload', (req, res, next) => {
      const { content, format, idempotencyKey, policyVersion } = req.body || {};
      if (!content) return next(new ValidationError('No file content was provided.'));
      const parcels = this.#secureBatchParser.parse(content, format);
      const batch = this.#processAndDetect(parcels, { idempotencyKey, policyVersion, req, source: 'upload' });
      res.status(201).json(batch);
    });

    router.get('/batches', (req, res) => {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const offset = Number(req.query.offset) || 0;
      const all = [...this.#batchService.list()].reverse();
      res.status(200).json({ total: all.length, limit, offset, batches: all.slice(offset, offset + limit) });
    });

    router.get('/batches/:id', (req, res, next) => {
      const batch = this.#batchService.get(req.params.id);
      if (!batch) return next(new NotFoundError('Batch was not found.'));
      res.status(200).json(batch);
    });

    router.post('/batches/:id/retry', (req, res) => {
      const result = this.#retryService.retry(req.params.id, { actor: req.identity.actor, role: req.identity.role, correlationId: req.correlationId });
      res.status(200).json(result);
    });

    return router;
  }

  #processAndDetect(parcels, { idempotencyKey, policyVersion, req, source }) {
    const batch = this.#batchService.process(parcels, {
      idempotencyKey,
      actor: req.identity.actor,
      role: req.identity.role,
      correlationId: req.correlationId,
      policyVersion,
      source
    });
    if (!batch.deduplicated) this.#incidentDetectorService.detectFromBatch(batch);
    return batch;
  }
}
