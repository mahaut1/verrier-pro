import type { Express, Request, Response } from 'express';
import { z } from 'zod';
import { insertGallerySchema } from "../../shared/schema.js";
import { GalleriesStorage } from '../storage/galleries.storage.js';

export const storages = {
  galleries: new GalleriesStorage(),
};
// Helpers
const paramsIdSchema = z.object({ id: z.coerce.number().int().positive() });

// PATCH = champs partiels, jamais userId/createdAt/updatedAt
const updateGallerySchema = insertGallerySchema
  .partial()
  .omit({ /* on interdit tout ce qui ne doit pas être patché par le client */ });

const listQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform(v => v === 'true')
    .optional(),
  q: z.string().trim().min(1).optional(), // recherche texte basique
});

export function registerGalleryRoutes(app: Express, requireAuth: any) {
  // CREATE
  app.post('/api/galleries', requireAuth, async (req: Request, res: Response) => {
    const body = insertGallerySchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ message: 'Données invalides', errors: body.error.issues });
    }
    const row = await storages.galleries.createGallery(req.session.userId!, body.data as any);
    return res.status(201).json(row);
  });

  // LIST (+ petits filtres)
  app.get('/api/galleries', requireAuth, async (req: Request, res: Response) => {
    const q = listQuerySchema.safeParse(req.query);
    if (!q.success) {
      return res.status(400).json({ message: 'Paramètres invalides', errors: q.error.issues });
    }
    const rows = await storages.galleries.listGalleries(req.session.userId!, q.data);
    return res.json(rows);
  });

  // GET by id
  app.get('/api/galleries/:id', requireAuth, async (req: Request, res: Response) => {
    const p = paramsIdSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: 'Paramètres invalides', errors: p.error.issues });
    }
    const row = await storages.galleries.getGalleryById(req.session.userId!, p.data.id);
    if (!row) return res.status(404).json({ message: 'Galerie introuvable' });
    return res.json(row);
  });

  // UPDATE (PATCH)
  app.patch('/api/galleries/:id', requireAuth, async (req: Request, res: Response) => {
    const p = paramsIdSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: 'Paramètres invalides', errors: p.error.issues });
    }
    const body = updateGallerySchema.safeParse(req.body);
    if (!body.success) {
      return res.status(400).json({ message: 'Données invalides', errors: body.error.issues });
    }
    const row = await storages.galleries.updateGallery(req.session.userId!, p.data.id, body.data as any);
    if (!row) return res.status(404).json({ message: 'Galerie introuvable' });
    return res.json(row);
  });

  // DELETE
  app.delete('/api/galleries/:id', requireAuth, async (req: Request, res: Response) => {
    const p = paramsIdSchema.safeParse(req.params);
    if (!p.success) {
      return res.status(400).json({ message: 'Paramètres invalides', errors: p.error.issues });
    }
    const ok = await storages.galleries.deleteGallery(req.session.userId!, p.data.id);
    if (!ok) return res.status(404).json({ message: 'Galerie introuvable' });
    return res.status(204).send();
  });
}
