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

// Schéma de query pour LIST
const listQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),                
  pieceTypeId: z.coerce.number().int().positive().optional(),
  galleryId: z.coerce.number().int().positive().optional(),
  // filtre d’éligibilité pour une commande
  availableForOrder: z
    .enum(["true", "false"])
    .transform(v => v === "true")
    .optional(),
  orderId: z.coerce.number().int().positive().optional(),
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
      const { status, pieceTypeId, galleryId, availableForOrder, orderId } = parsed.data;
      const filters: PieceListQuery = {status,pieceTypeId,galleryId,};
      let rows = await storage.listPieces(req.session.userId!, filters);
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
        const withSigned = await Promise.all(
        rows.map(async (p) => ({
          ...p,
        }))
      );

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
app.delete(
  "/api/pieces/:id/image",
  requireAuth,
  async (req, res) => {
    const parsed = idParam.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ message: "Paramètres invalides", errors: parsed.error.issues });
    }
    const userId = req.session.userId!;
    const pieceId = parsed.data.id;
    const piece = await storage.getPieceById(userId, pieceId);
    if (!piece) return res.status(404).json({ message: "Pièce introuvable" });
  if (piece.imageUrl && R2_AVAILABLE) {
        try {
          const key = /^https?:\/\//i.test(piece.imageUrl)
            ? keyFromPublicUrl(piece.imageUrl)
            : piece.imageUrl;
          if (!key.startsWith("/uploads/")) {
            await r2DeleteObject(key);
          }
        } catch {
        }
      }
      const updated = await storage.clearPieceImage(userId, pieceId);
      if (!updated) return res.status(404).json({ message: "Pièce introuvable" });
      updated.imageUrl = null;
      return res.json(updated);
    })

    app.get("/api/images/:key(*)", (req, res) => {
  const key = req.params.key || "";
  const b64 = Buffer.from(key, "utf8")
    .toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  res.redirect(301, `/api/r2/object/${b64}`);
});

}

