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

/* Schemas */
const insertEventSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  type: z.string().min(1, "Type requis"), // 'exhibition' | 'fair' | 'workshop' | 'sale' (libre ici)
  venue: z.string().trim().optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  website: z.string().trim().optional().nullable(),
  participationFee: z.string().trim().optional().nullable(), // décimal en string côté API
  status: z.enum(["planned", "confirmed", "completed", "cancelled"]).optional(),
  notes: z.string().trim().optional().nullable(),
});
const updateEventSchema = insertEventSchema.partial();

const eventPieceInput = z.object({
  pieceId: z.coerce.number().int().positive(),
  displayPrice: z.string().trim().optional().nullable(),
  sold: z.coerce.boolean().optional().default(false),
});

/* ✨ Schéma complet pour PATCH (événement + pièces) */
const updateEventWithPiecesSchema = updateEventSchema.extend({
  pieces: z.array(eventPieceInput).optional(),
});

const listQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export function registerEventRoutes(app: Express, requireAuth: RequestHandler) {
  // CREATE
  app.post(
    "/api/events",
    requireAuth,
    handleAsync(async (req, res) => {
      const v = insertEventSchema.safeParse(req.body);
      if (!v.success) {
        return res.status(400).json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.createEvent(req.session.userId!, v.data);
      return res.status(201).json(row);
    })
  );

  // LIST
  app.get(
    "/api/events",
    requireAuth,
    handleAsync(async (req, res) => {
      const q = listQuerySchema.safeParse(req.query);
      if (!q.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: q.error.issues });
      }
      const rows = await storage.listEvents(req.session.userId!, q.data);
      return res.json(rows);
    })
  );

  // GET by id
  app.get(
    "/api/events/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const row = await storage.getEventById(req.session.userId!, p.data.id);
      if (!row) return res.status(404).json({ message: "Événement introuvable" });
      return res.json(row);
    })
  );

  // UPDATE (PATCH)
  app.patch(
    "/api/events/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }

      const body = updateEventWithPiecesSchema.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ message: "Données invalides", errors: body.error.issues });
      }

      const { pieces, ...eventPatch } = body.data;
      const row = await storage.updateEventWithPieces(
        req.session.userId!,
        p.data.id,
        eventPatch,
        pieces
      );

      if (!row) return res.status(404).json({ message: "Événement introuvable" });
      return res.json(row);
    })
  );
  // DELETE
  app.delete(
    "/api/events/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deleteEvent(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: "Événement introuvable" });
      return res.status(204).send();
    })
  );
}
