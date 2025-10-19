import type {
  Express as ExpressApp,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import multer from "multer";
import type { FileFilterCallback } from "multer";
import { storage } from "../storage/index.js";
import { insertPieceSchema } from "../../shared/schema.js";
import type * as sch from "../../shared/schema.js";
import type { PieceListQuery } from "../storage/index.js";
import { R2_AVAILABLE,r2PutObject, r2DeleteObject, keyFromPublicUrl  } from "../lib/r2.js";

//  types locaux 
type PieceInsert = typeof sch.pieces.$inferInsert;
type PiecePatch = Partial<
  Omit<PieceInsert, "id" | "userId" | "createdAt" | "updatedAt">
>;

//  helpers 
const idParam = z.object({ id: z.coerce.number().int().positive() });
const updatePieceSchema = insertPieceSchema.partial();

function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}



// Multer (3MB, jpg/png/webp)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    ok ? cb(null, true) : cb(new Error("Type de fichier non supporté (jpg/png/webp)"));
  },
});

// Nettoyage simple de nom de fichier (évite d’ajouter une dépendance)
function sanitizeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")     // accents
    .replace(/\s+/g, "_")                // espaces -> _
    .replace(/[^a-zA-Z0-9._-]/g, "")     // caractères sûrs
    .slice(0, 150);                      // borne raisonnable
}

// Schéma de query pour LIST (supporte pagination optionnelle et filtres élargis)
const listQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),                
  pieceTypeId: z.coerce.number().int().positive().optional(),
  pieceSubtypeId: z.coerce.number().int().positive().optional(),
  galleryId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).optional(),
  // filtre d’éligibilité pour une commande
  availableForOrder: z
    .enum(["true", "false"]) 
    .transform(v => v === "true")
    .optional(),
  orderId: z.coerce.number().int().positive().optional(),
  // pagination optionnelle, activée via ?paginated=true
  paginated: z
    .enum(["true", "false"]) 
    .transform(v => v === "true")
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

export function registerPieceRoutes(app: ExpressApp, requireAuth: RequestHandler) {
  // CREATE
  app.post(
    "/api/pieces",
    requireAuth,
    handleAsync(async (req, res) => {
      const v = insertPieceSchema.safeParse(req.body);
      if (!v.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: v.error.issues });
      }
      const row = await storage.createPiece(req.session.userId!, v.data);
      return res.status(201).json(row);
    })
  );

  // LIST (+ filtres: status, pieceTypeId, galleryId, availableForOrder/orderId)
  app.get(
    "/api/pieces",
    requireAuth,
    handleAsync(async (req, res) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: parsed.error.issues });
      }
      const { status, pieceTypeId, pieceSubtypeId, galleryId, search, availableForOrder, orderId, paginated, page = 1, pageSize = 12 } = parsed.data;
      const filters: PieceListQuery = { status, pieceTypeId, galleryId };

      // 1) Récupère toutes les pièces filtrées de base (côté storage)
      let rows = await storage.listPieces(req.session.userId!, filters);
      
      // 2) Filtres additionnels au niveau route
      if (pieceSubtypeId) {
        rows = rows.filter((p: any) => p.pieceSubtypeId === pieceSubtypeId);
      }
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((p: any) =>
          (p.name ?? "").toLowerCase().includes(s) || (p.description ?? "").toLowerCase().includes(s)
        );
      }
      if (availableForOrder) {
        let targetGalleryId: number | undefined;
        if (orderId) {
          const order = await storage.getOrderById(req.session.userId!, orderId);
          if (!order) return res.status(404).json({ message: "Commande introuvable" });
          targetGalleryId = order.galleryId ?? undefined;
        } else if (galleryId) {
          targetGalleryId = galleryId;
        }
        rows = rows.filter((p) => {
          const notSold = p.status !== "sold";
          if (!targetGalleryId) return notSold;
          return notSold && (p.galleryId == null || p.galleryId === targetGalleryId);
        });
      }
        const withSigned = await Promise.all(rows.map(async (p) => ({ ...p })));

        // 4) Pagination optionnelle et réponse compatible
        if (paginated) {
          const total = withSigned.length;
          const totalPages = Math.max(1, Math.ceil(total / pageSize));
          const safePage = Math.min(Math.max(1, page), totalPages);
          const start = (safePage - 1) * pageSize;
          const end = start + pageSize;
          const items = withSigned.slice(start, end);
          return res.json({ items, pagination: { page: safePage, pageSize, total, totalPages } });
        }

        // Ancienne forme: tableau simple
        return res.json(withSigned);
    })
  );

  // GET by id
  app.get(
    "/api/pieces/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const row = await storage.getPieceById(req.session.userId!, p.data.id);
      if (!row) return res.status(404).json({ message: "Pièce introuvable" });
      return res.json(row);
    })
  );

// UPDATE (PATCH)
app.patch(
  "/api/pieces/:id",
  requireAuth,
  handleAsync(async (req, res) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
    }
    const body = updatePieceSchema.safeParse(req.body); // insertPieceSchema.partial()
    if (!body.success) {
      return res.status(400).json({ message: "Données invalides", errors: body.error.issues });
    }
    const patch = body.data as PiecePatch;
    const hasStatus    = Object.prototype.hasOwnProperty.call(patch, "status");
    const hasGalleryId = Object.prototype.hasOwnProperty.call(patch, "galleryId");
    const nextPatch: PiecePatch = { ...patch };
    if (!hasStatus && hasGalleryId) {
      nextPatch.status = patch.galleryId ? "gallery" : "workshop";
    }
    const row = await storage.updatePiece(req.session.userId!, p.data.id, nextPatch);
    if (!row) return res.status(404).json({ message: "Pièce introuvable" });
    return res.json(row);
  })
);


  // DELETE
  app.delete(
    "/api/pieces/:id",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const ok = await storage.deletePiece(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: "Pièce introuvable" });
      return res.status(204).send();
    })
  );

  // UPLOAD image
app.post(
  "/api/pieces/:id/image",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: parsed.error.issues });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé" });
    }
    if (!R2_AVAILABLE) {
      return res.status(500).json({ message: "Stockage R2 non configuré" });
    }

      const userId = req.session.userId!;
      const pieceId = parsed.data.id;
      const original = sanitizeFilename(req.file.originalname || "image");
      const ext = original.includes(".") ? original.slice(original.lastIndexOf(".")) : "";
      const key = `pieces/${userId}/${pieceId}-${Date.now()}-${randomUUID()}${ext}`;
      await r2PutObject(key, req.file.buffer, req.file.mimetype);
      const updated = await storage.setPieceImage(userId, pieceId, key);
      if (!updated) return res.status(404).json({ message: "Pièce introuvable" });
      return res.json(updated);
    })
  

  // DELETE image
app.delete("/api/pieces/:id/image", requireAuth, async (req, res) => {
  const parsed = idParam.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Paramètres invalides", errors: parsed.error.issues });
  const userId = req.session.userId!;
  const pieceId = parsed.data.id;
  const piece = await storage.getPieceById(userId, pieceId);
  if (!piece) return res.status(404).json({ message: "Pièce introuvable" });
  if (piece.imageUrl && R2_AVAILABLE) {
    const key = keyFromPublicUrl(piece.imageUrl);
    if (key) {
      try {
        await r2DeleteObject(key);
      } catch (e) {
        console.warn("⚠️ R2 delete failed:", key, e);
      }
    }
  }
  const updated = await storage.clearPieceImage(userId, pieceId);
  if (!updated) return res.status(404).json({ message: "Pièce introuvable" });
  updated.imageUrl = null;
  return res.json(updated);
});

// REPLACE image (upload + suppression de l'ancienne)
app.patch(
  "/api/pieces/:id/image",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: parsed.error.issues });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé" });
    }
    if (!R2_AVAILABLE) {
      return res.status(500).json({ message: "Stockage R2 non configuré" });
    }
    const userId = req.session.userId!;
    const pieceId = parsed.data.id;
    const piece = await storage.getPieceById(userId, pieceId);
    if (!piece) return res.status(404).json({ message: "Pièce introuvable" });
    const oldKey = keyFromPublicUrl(piece.imageUrl || "");
    const original = sanitizeFilename(req.file.originalname || "image");
    const ext = original.includes(".") ? original.slice(original.lastIndexOf(".")) : "";
    const newKey = `pieces/${userId}/${pieceId}-${Date.now()}-${randomUUID()}${ext}`;
    try {
      await r2PutObject(newKey, req.file.buffer, req.file.mimetype);
      const updated = await storage.setPieceImage(userId, pieceId, newKey);
      if (!updated) {
        try { await r2DeleteObject(newKey); } catch {}
        return res.status(404).json({ message: "Pièce introuvable" });
      }
      if (oldKey && oldKey !== newKey) {
        try {
          await r2DeleteObject(oldKey);
        } catch (e) {
          console.warn("⚠️ Suppression ancienne image R2 échouée:", oldKey, e);
        }
      }
      return res.json(updated);
    } catch (e) {
      console.error("❌ Replace image failed:", e);
      return res.status(500).json({ message: "Échec du remplacement de l'image" });
    }
  }
);


}

