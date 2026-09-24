import { Router } from 'express';

export class DashboardController {
  #dashboardService;
  constructor({ dashboardService }) { this.#dashboardService = dashboardService; }

  buildRouter() {
    const router = Router();
    router.get('/dashboard', (req, res) => res.status(200).json(this.#dashboardService.snapshot()));
    return router;
  }
}
