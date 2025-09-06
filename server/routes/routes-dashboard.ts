import type { Express, Request, Response } from "express";
import { z } from "zod";
import { DashboardStorage } from "../storage/dashboard.storage.js";

const storages = {
  dashboard: new DashboardStorage(),
};

const lowStockQuery = z.object({
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export function registerDashboardRoutes(app: Express, requireAuth: (req: Request, res: Response, next: () => void) => void) {
  app.get("/api/dashboard/stats", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const stats = await storages.dashboard.getStats(userId);
    return res.json(stats);
  });

  app.get("/api/stock-items/low-stock", requireAuth, async (req: Request, res: Response) => {
    const userId = req.session.userId!;
    const q = lowStockQuery.safeParse(req.query);
    if (!q.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: q.error.issues });
    }
    const rows = await storages.dashboard.listLowStock(userId, q.data.limit ?? 3);
    return res.json(rows);
  });
}
