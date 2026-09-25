import { Router } from 'express';

export class DashboardController {
  #readModelsFor;
  constructor({ readModelsFor }) { this.#readModelsFor = readModelsFor; }

  buildRouter() {
    const router = Router();
    router.get('/dashboard', (req, res) => {
      const { scope, dashboardService } = this.#readModelsFor(req.identity);
      res.status(200).json({ ...dashboardService.overview(), scope });
    });
    return router;
  }
}
