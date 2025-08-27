import type {Express as ExpressApp, Request, Response, NextFunction, RequestHandler,} from "express";
import { z } from "zod";
import { storage } from "../storage/index.js";
import { insertStockItemSchema, insertStockMovementSchema } from "../../shared/schema.js";

/* zod  */
const idParam = z.object({ id: z.coerce.number().int().positive() });
const patchMovementSchema = insertStockMovementSchema.partial();
const updateItemSchema = insertStockItemSchema.partial();

const listItemsQuery = z.object({
  type: z.string().optional(),
  category: z.string().optional(),
  q: z.string().optional(),
  lowOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const listMovementsQuery = z.object({
  itemId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

/*  helper  */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

function handleAsync(fn: AsyncHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise
      .resolve(fn(req, res, next))
      .catch(next);
  };
}

export function registerStockRoutes(app: ExpressApp, requireAuth: RequestHandler) {
  app.post("/api/stock/items",requireAuth,handleAsync(async (req, res) => {
      const v = insertStockItemSchema.safeParse(req.body);
      if (!v.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.createStockItem(req.session.userId!, v.data);
      res.status(201).json(row);
    })
  );

  app.get("/api/stock/items",requireAuth,handleAsync(async (req, res) => {
      const q = listItemsQuery.safeParse(req.query);
      if (!q.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: q.error.issues });
      }
      const rows = await storage.listStockItems(req.session.userId!, q.data);
      res.json(rows);
    })
  );

  app.get("/api/stock/items/:id",requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const row = await storage.getStockItemById(req.session.userId!, p.data.id);
      if (!row) return res.status(404).json({ message: "Article introuvable" });
      res.json(row);
    })
  );

  app.patch("/api/stock/items/:id", requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const v = updateItemSchema.safeParse(req.body);
      if (!v.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.updateStockItem(
        req.session.userId!,
        p.data.id,
        v.data
      );
      if (!row) return res.status(404).json({ message: "Article introuvable" });
      res.json(row);
    })
  );

  app.delete("/api/stock/items/:id", requireAuth, handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deleteStockItem(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: "Article introuvable" });
      res.status(204).send();
    })
  );

  /** MOVEMENTS **/
  app.post("/api/stock/movements", requireAuth, handleAsync(async (req, res) => {
      const v = insertStockMovementSchema.safeParse(req.body);
      if (!v.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.createStockMovement(req.session.userId!, v.data);
      res.status(201).json(row);
    })
  );

  app.get( "/api/stock/movements", requireAuth, handleAsync(async (req, res) => {
      const q = listMovementsQuery.safeParse(req.query);
      if (!q.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: q.error.issues });
      }
      const rows = await storage.listStockMovements(req.session.userId!, q.data);
      res.json(rows);
    })
  );

 app.get( "/api/stock/movements/:id", requireAuth, handleAsync(async (req, res) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
    }
    const row = await storage.getStockMovementById(req.session.userId!, p.data.id);
    if (!row) return res.status(404).json({ message: "Mouvement introuvable" });
    res.json(row);
  })
);

// PATCH movement
  app.patch( "/api/stock/movements/:id", requireAuth, handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const v = patchMovementSchema.safeParse(req.body);
      if (!v.success) {
        return res.status(400).json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.updateStockMovement(req.session.userId!, p.data.id, v.data);
      if (!row) return res.status(404).json({ message: "Mouvement introuvable" });
      res.json(row);
    })
  );

  // DELETE movement
  app.delete( "/api/stock/movements/:id", requireAuth, handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deleteStockMovement(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: "Mouvement introuvable" });
      res.status(204).send();
    })
  );
}
