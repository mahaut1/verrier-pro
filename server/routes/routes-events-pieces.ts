import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../storage/index.js";

/* Helpers */
function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
const idParam = z.object({ id: z.coerce.number().int().positive() });
const eventIdParam = z.object({ eventId: z.coerce.number().int().positive() });

/* Schemas */
const addEventPieceSchema = z.object({
  pieceId: z.coerce.number().int().positive(),
  displayPrice: z.string().trim().optional().nullable(), // décimal en string
  sold: z.coerce.boolean().optional(),
});

const updateEventPieceSchema = z.object({
  pieceId: z.coerce.number().int().positive().optional(),
  displayPrice: z.string().trim().optional().nullable(),
  sold: z.coerce.boolean().optional(),
});

export function registerEventPieceRoutes(app: Express, requireAuth: RequestHandler) {
    // ADD to event
  app.post(
    "/api/events/:eventId/pieces",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = eventIdParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const v = addEventPieceSchema.safeParse(req.body);
      if (!v.success) {
        return res.status(400).json({ message: "Données invalides", errors: v.error.issues });
      }

      const row = await storage.addEventPiece(
        req.session.userId!,
        p.data.eventId,
        v.data.pieceId,
        v.data.displayPrice ?? null,
        v.data.sold ?? false
      );
      return res.status(201).json(row);
    })
  );
  
  app.get(
    "/api/events/:eventId/pieces",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = eventIdParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const rows = await storage.listEventPieces(req.session.userId!, p.data.eventId);
      return res.json(rows);
    })
  );



  // UPDATE 
  app.patch(
    "/api/event-pieces/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const body = updateEventPieceSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Données invalides", errors: body.error.issues });
      }
      const row = await storage.updateEventPiece(req.session.userId!, p.data.id, body.data);
      if (!row) return res.status(404).json({ message: "Ligne introuvable" });
      return res.json(row);
    })
  );

  // DELETE 
  app.delete(
    "/api/event-pieces/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deleteEventPiece(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: "Ligne introuvable" });
      return res.status(204).send();
    })
  );
}
