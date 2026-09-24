import { Router } from 'express';

export class DashboardController {
  #dashboardService;
  constructor({ dashboardService }) { this.#dashboardService = dashboardService; }

  buildRouter() {
    const router = Router();
    router.get('/dashboard', (_req, res) => res.status(200).json(this.#dashboardService.overview()));
    return router;
  }
}
