import { Router } from 'express';
import { NotFoundError, ValidationError } from '../../errors/index.js';

/** Risk outlook, incident center, failure fingerprinting, and the Operations Assistant (master prompt sections 18-20, 27). */
export class IntelligenceController {
  #incidentDetectorService;
  #auditService;
  #readModelsFor;

  constructor({ incidentDetectorService, auditService, readModelsFor }) {
    this.#incidentDetectorService = incidentDetectorService;
    this.#auditService = auditService;
    this.#readModelsFor = readModelsFor;
  }

  buildRouter() {
    const router = Router();

    router.get('/risk', async (req, res, next) => {
      try { res.status(200).json(await this.#readModelsFor(req.identity).riskNarrator.assess()); } catch (error) { next(error); }
    });
    router.get('/failure-dna', (req, res) => res.status(200).json(this.#readModelsFor(req.identity).failureDnaService.analyze()));

    router.get('/incidents', (req, res) => res.status(200).json(this.#readModelsFor(req.identity).incidents.list()));
    router.post('/incidents/:id/transition', (req, res, next) => {
      const { status } = req.body || {};
      if (!status) return next(new ValidationError('A target status is required.'));
      if (!this.#readModelsFor(req.identity).incidents.get(req.params.id)) return next(new NotFoundError('Incident was not found.'));
      const updated = this.#incidentDetectorService.transition(req.params.id, status, { actor: req.identity.actor });
      res.status(200).json(updated);
    });

    router.post('/assistant/ask', async (req, res, next) => {
      try {
        const { question } = req.body || {};
        if (!question) return next(new ValidationError('A question is required.'));
        const answer = await this.#readModelsFor(req.identity).operationsAssistantService.ask(question);
        this.#auditService.record({ action: 'assistant_query', entity: 'assistant', actor: req.identity.actor, correlationId: req.correlationId, newValue: { question, unresolved: answer.unresolved, source: answer.source } });
        res.status(200).json(answer);
      } catch (error) { next(error); }
    });

    return router;
  }
}
