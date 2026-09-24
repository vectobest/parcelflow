import { Router } from 'express';
import { ValidationError } from '../../errors/index.js';

/** Risk outlook, incident center, failure fingerprinting, and the Operations Assistant (master prompt sections 18-20, 27). */
export class IntelligenceController {
  #riskNarrator;
  #incidentDetectorService;
  #failureDnaService;
  #operationsAssistantService;
  #auditService;

  constructor({ riskNarrator, incidentDetectorService, failureDnaService, operationsAssistantService, auditService }) {
    this.#riskNarrator = riskNarrator;
    this.#incidentDetectorService = incidentDetectorService;
    this.#failureDnaService = failureDnaService;
    this.#operationsAssistantService = operationsAssistantService;
    this.#auditService = auditService;
  }

  buildRouter() {
    const router = Router();

    router.get('/risk', async (_req, res, next) => {
      try { res.status(200).json(await this.#riskNarrator.assess()); } catch (error) { next(error); }
    });
    router.get('/failure-dna', (_req, res) => res.status(200).json(this.#failureDnaService.analyze()));

    router.get('/incidents', (_req, res) => res.status(200).json(this.#incidentDetectorService.list()));
    router.post('/incidents/:id/transition', (req, res, next) => {
      const { status } = req.body || {};
      if (!status) return next(new ValidationError('A target status is required.'));
      const updated = this.#incidentDetectorService.transition(req.params.id, status, { actor: req.identity.actor });
      res.status(200).json(updated);
    });

    router.post('/assistant/ask', async (req, res, next) => {
      try {
        const { question } = req.body || {};
        if (!question) return next(new ValidationError('A question is required.'));
        const answer = await this.#operationsAssistantService.ask(question);
        this.#auditService.record({ action: 'assistant_query', entity: 'assistant', actor: req.identity.actor, correlationId: req.correlationId, newValue: { question, unresolved: answer.unresolved, source: answer.source } });
        res.status(200).json(answer);
      } catch (error) { next(error); }
    });

    return router;
  }
}
