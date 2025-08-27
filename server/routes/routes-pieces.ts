import type {
  Express as ExpressApp,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { z } from "zod";
import multer from "multer";
import type { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../storage/index.js";
import { insertPieceSchema } from "../../shared/schema.js";
import type * as sch from "../../shared/schema.js";
import type { PieceListQuery } from "../storage/index.js";


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

// Dossier upload
const uploadDir = path.resolve(process.cwd(), "uploads", "pieces");
fs.mkdirSync(uploadDir, { recursive: true });

// Multer (3MB, jpg/png/webp)
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const base = file.originalname
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9._-]/g, "");
      cb(null, `${ts}_${base}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(
      file.mimetype
    );
    if (ok) cb(null, true);
    else cb(new Error("Type de fichier non supporté (jpg/png/webp seulement)"));
  },
});

// Schéma de query pour LIST
const listQuerySchema = z.object({
  status: z.string().trim().min(1).optional(),                // ex: 'workshop', 'gallery', 'sold', ...
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
      const filters: PieceListQuery = {
        status,
        pieceTypeId,
        galleryId,
      };
      let rows = await storage.listPieces(req.session.userId!, filters);
      if (availableForOrder) {
        // Récupère la galerie cible depuis l'order si fourni
        let targetGalleryId: number | undefined;
        if (orderId) {
          const order = await storage.getOrderById(req.session.userId!, orderId);
          if (!order) return res.status(404).json({ message: "Commande introuvable" });
          targetGalleryId = order.galleryId ?? undefined;
        } else if (galleryId) {
          targetGalleryId = galleryId;
        }
        // Éligible = non vendue, et si commande a une galerie :
        // - pièces sans galerie OU avec la même galerie
        rows = rows.filter((p) => {
          const notSold = p.status !== "sold";
          if (!targetGalleryId) return notSold;
          return notSold && (p.galleryId == null || p.galleryId === targetGalleryId);
        });
      }
      return res.json(rows);
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
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
     const body = updatePieceSchema.safeParse(req.body);
      if (!body.success) {
        return res
          .status(400)
          .json({ message: "Données invalides", errors: body.error.issues });
      }

        const patch = body.data as PiecePatch;
      const nextPatch: PiecePatch = { ...patch };

      if ("galleryId" in patch) {
        nextPatch.status = patch.galleryId ? "gallery" : "workshop";
      }

      const row = await storage.updatePiece(
        req.session.userId!,
        p.data.id,
        body.data as PiecePatch
      );
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
  handleAsync(async (req, res) => {
    const p = idParam.safeParse(req.params);
    if (!p.success) return res.status(400).json({ message: "Paramètres invalides", errors: p.error.issues });
    if (!req.file) return res.status(400).json({ message: "Aucun fichier envoyé" });
    const imageUrl = `/uploads/pieces/${req.file.filename}`;

    const row = await storage.setPieceImage(req.session.userId!, p.data.id, imageUrl);
    if (!row) return res.status(404).json({ message: "Pièce introuvable" });
    return res.json(row);
  })
);


  // DELETE image (supprime le fichier si présent)
  app.delete(
    "/api/pieces/:id/image",
    requireAuth,
    handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: "Paramètres invalides", errors: p.error.issues });
      }
      const current = await storage.getPieceById(
        req.session.userId!,
        p.data.id
      );
      if (!current) {
        return res.status(404).json({ message: "Pièce introuvable" });
      }

      // Gère URL absolue ou chemin relatif
      let pathname: string | null = null;
      try {
        pathname = new URL(current.imageUrl ?? "").pathname;
      } catch {
        pathname = current.imageUrl ?? null;
      }

      if (pathname && pathname.startsWith("/uploads/pieces/")) {
        const filePath = path.join(process.cwd(), pathname);
        await fs.promises.unlink(filePath).catch(() => {
          /* on ignore si déjà supprimé */
        });
      }

      const row = await storage.clearPieceImage(
        req.session.userId!,
        p.data.id
      );
      if (!row) return res.status(404).json({ message: "Pièce introuvable" });
      return res.json(row);
    })
  );
}
