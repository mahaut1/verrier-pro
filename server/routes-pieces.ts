import type { FileFilterCallback } from 'multer';
import type { Express as ExpressApp, Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { insertPieceSchema } from '@shared/schema';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ---------- helpers ----------
const idParam = z.object({ id: z.coerce.number().int().positive() });
// PATCH-friendly (tous les champs optionnels)
const updatePieceSchema = insertPieceSchema.partial();

function handleAsync(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Dossier upload
const uploadDir = path.resolve(process.cwd(), 'uploads', 'pieces');
fs.mkdirSync(uploadDir, { recursive: true });

// Multer (3MB, jpg/png/webp)
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const base = file.originalname
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      cb(null, `${ts}_${base}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  if (ok) cb(null, true);
  else cb(new Error('Type de fichier non supporté (jpg/png/webp seulement)'));
},


});

export function registerPieceRoutes(app: ExpressApp, requireAuth: any) {
  // CREATE
  app.post( '/api/pieces',requireAuth, handleAsync(async (req, res) => {
      const v = insertPieceSchema.safeParse(req.body);
      if (!v.success) {
        return res
          .status(400)
          .json({ message: 'Données invalides', errors: v.error.issues });
      }
      const row = await storage.createPiece(req.session.userId!, v.data as any);
      return res.status(201).json(row);
    })
  );

  // LIST (+ filtres: status, type, galleryId)
  app.get( '/api/pieces',requireAuth, handleAsync(async (req, res) => {
      const rows = await storage.listPieces(req.session.userId!, {
        status: req.query.status as string | undefined,
        type: req.query.type as string | undefined,
        galleryId: req.query.galleryId ? Number(req.query.galleryId) : undefined,
      });
      return res.json(rows);
    })
  );

  // GET by id
  app.get('/api/pieces/:id',requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: 'Paramètres invalides', errors: p.error.issues });
      }
      const row = await storage.getPieceById(req.session.userId!, p.data.id);
      if (!row) return res.status(404).json({ message: 'Pièce introuvable' });
      return res.json(row);
    })
  );

  // UPDATE (PATCH)
  app.patch('/api/pieces/:id',requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: 'Paramètres invalides', errors: p.error.issues });
      }
      const body = updatePieceSchema.safeParse(req.body);
      if (!body.success) {
        return res
          .status(400)
          .json({ message: 'Données invalides', errors: body.error.issues });
      }
      const row = await storage.updatePiece(
        req.session.userId!,
        p.data.id,
        body.data as any
      );
      if (!row) return res.status(404).json({ message: 'Pièce introuvable' });
      return res.json(row);
    })
    
  );

  // DELETE
  app.delete('/api/pieces/:id',requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: 'Paramètres invalides', errors: p.error.issues });
      }
      const ok = await storage.deletePiece(req.session.userId!, p.data.id);
      if (!ok) return res.status(404).json({ message: 'Pièce introuvable' });
      return res.status(204).send();
    })
  );

  // UPLOAD image
  app.post('/api/pieces/:id/image', requireAuth, upload.single('image'), handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: 'Paramètres invalides', errors: p.error.issues });
      }
      if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier envoyé' });
      }

 const baseUrl = process.env.BACKEND_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const imageUrl = `${baseUrl}/uploads/pieces/${req.file.filename}`;

      const row = await storage.setPieceImage(
        req.session.userId!,
        p.data.id,
        imageUrl
      );
      if (!row) return res.status(404).json({ message: 'Pièce introuvable' });
      return res.json(row);
    })
  );

  // DELETE image (supprime le fichier si présent)
  app.delete('/api/pieces/:id/image',requireAuth,handleAsync(async (req, res) => {
      const p = idParam.safeParse(req.params);
      if (!p.success) {
        return res
          .status(400)
          .json({ message: 'Paramètres invalides', errors: p.error.issues });
      }
      const current = await storage.getPieceById(req.session.userId!, p.data.id);
      if (!current) return res.status(404).json({ message: 'Pièce introuvable' });

      // supprimer le fichier
      if (current.imageUrl && current.imageUrl.startsWith('/uploads/pieces/')) {
        const filePath = path.join(process.cwd(), current.imageUrl);
        fs.promises.unlink(filePath).catch(() => {}); // on ignore les erreurs si déjà supprimé
      }
      const row = await storage.clearPieceImage(req.session.userId!, p.data.id);
      if (!row) return res.status(404).json({ message: 'Pièce introuvable' });
      return res.json(row);
    })
  );
}
