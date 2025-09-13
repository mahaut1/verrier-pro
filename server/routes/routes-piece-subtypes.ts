import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { storage } from "../storage/index.js";
import { insertPieceSubtypeSchema, updatePieceSubtypeSchema } from "../../shared/schema.js";

const idParam = z.object({ id: z.coerce.number().int().positive() });
const listQuery = z.object({
  pieceTypeId: z.coerce.number().int().positive().optional(),
  onlyActive: z
    .enum(["true", "false"])
    .transform(v => v === "true")
    .optional(),
});

export function registerPieceSubtypeRoutes(app: Express, requireAuth: RequestHandler) {
  // LIST
  app.get("/api/piece-subtypes", requireAuth, async (req, res) => {
    const q = listQuery.safeParse(req.query);
    if (!q.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: q.error.issues });
    }
    const rows = await storage.listPieceSubtypes(req.session.userId!, {
      pieceTypeId: q.data.pieceTypeId,
      // par défaut: onlyActive=true → on ne renvoie que les actifs
      isActive: q.data.onlyActive ?? true,
    });
    res.json(rows);
  });

  // CREATE
  app.post("/api/piece-subtypes", requireAuth, async (req, res) => {
    const v = insertPieceSubtypeSchema.safeParse(req.body);
    if (!v.success) {
      return res.status(400).json({ message: "Données invalides", errors: v.error.issues });
    }
    const row = await storage.createPieceSubtype(req.session.userId!, v.data);
    res.status(201).json(row);
  });

  // UPDATE
  app.patch("/api/piece-subtypes/:id", requireAuth, async (req, res) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
    }
    const v = updatePieceSubtypeSchema.safeParse(req.body);
    if (!v.success) {
      return res.status(400).json({ message: "Données invalides", errors: v.error.issues });
    }
    const row = await storage.updatePieceSubtype(req.session.userId!, p.data.id, v.data);
    if (!row) return res.status(404).json({ message: "Sous-type introuvable" });
    res.json(row);
  });

  // DELETE
  app.delete("/api/piece-subtypes/:id", requireAuth, async (req, res) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
    }
    const ok = await storage.deletePieceSubtype(req.session.userId!, p.data.id);
    if (!ok) return res.status(404).json({ message: "Sous-type introuvable" });
    res.status(204).send();
  });
}
