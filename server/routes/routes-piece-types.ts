import type {
  Express as ExpressApp,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { z } from "zod";
import { storage } from "../storage/index.js";
import { insertPieceTypeSchema } from "../../shared/schema.js";

// ---------- helpers ----------
const idParam = z.object({ id: z.coerce.number().int().positive() });

// create: autoriser (optionnellement) isActive même si l’insert schema l’omit
const createPieceTypeSchema = insertPieceTypeSchema.extend({
  isActive: z.boolean().optional(),
});

// update: PATCH friendly (tout optionnel)
const updatePieceTypeSchema = createPieceTypeSchema.partial();

// query: /api/piece-types?isActive=true&q=poisson
const listQuerySchema = z.object({
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  q: z.string().trim().min(1).optional(),
});

function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function registerPieceTypeRoutes(app: ExpressApp, requireAuth: RequestHandler) {
  // CREATE
  app.post(
    "/api/piece-types",
    requireAuth,
    handleAsync(async (req, res) => {
      const parsed = createPieceTypeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: parsed.error.issues });
      }
      const row = await storage.createPieceType(
        req.session.userId!,
        parsed.data
      );
      return res.status(201).json(row);
    })
  );

  // LIST
  app.get(
    "/api/piece-types",
    requireAuth,
    handleAsync(async (req, res) => {
      const q = listQuerySchema.safeParse(req.query);
      if (!q.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: q.error.issues });
      }
      const rows = await storage.listPieceTypes(req.session.userId!, q.data);
      return res.json(rows);
    })
  );

  // GET by id
  app.get(
    "/api/piece-types/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const row = await storage.getPieceTypeById(
        req.session.userId!,
        p.data.id
      );
      if (!row) return res.status(404).json({ message: "Type introuvable" });
      return res.json(row);
    })
  );

  // UPDATE (PATCH)
  app.patch(
    "/api/piece-types/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const body = updatePieceTypeSchema.safeParse(req.body);
      if (!body.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: body.error.issues });
      }
      const row = await storage.updatePieceType(
        req.session.userId!,
        p.data.id,
        body.data
      );
      if (!row) return res.status(404).json({ message: "Type introuvable" });
      return res.json(row);
    })
  );

  // DELETE
  app.delete(
    "/api/piece-types/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deletePieceType(
        req.session.userId!,
        p.data.id
      );
      if (!ok) return res.status(404).json({ message: "Type introuvable" });
      return res.status(204).send();
    })
  );
}
