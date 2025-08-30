// server/routes/routes-r2-direct-upload.ts
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_AVAILABLE, __R2_INTERNAL__ } from "../lib/r2.js";
import sanitize from "sanitize-filename";
import { storage } from "../storage/index.js"; // où tu exposes ton storage
import { resolveImageUrl } from "../../shared/images.js";

const bodySchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1)
});

export function registerR2DirectUploadRoutes(app: Express) {
  // 1) demande d’URL pré-signée pour un PUT
  app.post("/api/pieces/:id/image/presign", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Non autorisé" });
    if (!R2_AVAILABLE || !r2Client) return res.status(500).json({ message: "R2 non configuré" });

    const pid = Number(req.params.id);
    if (!Number.isFinite(pid)) return res.status(400).json({ message: "id invalide" });

    const parse = bodySchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ message: "payload invalide", errors: parse.error.issues });

    const { filename, contentType } = parse.data;

    const safeName = sanitize(filename);
    const key = `pieces/${req.session.userId}/${pid}-${Date.now()}-${safeName}`;

    // URL PUT signée (aucun appel réseau)
    const putCmd = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable"
    });
    const signedPutUrl = await getSignedUrl(r2Client, putCmd, { expiresIn: 600 });

    // URL "affichable" (publique-style) pour la DB
    const publicBase = __R2_INTERNAL__.PUBLIC_BASE_WITH_BUCKET; // ajouté dans lib/r2.ts ci-dessous
    const displayUrl = `${publicBase}/${key}`;

    return res.json({
      putUrl: signedPutUrl,
      key,
      displayUrl,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  });

  // 2) endpoint pour sauver l’URL dans la DB APRÈS le PUT réussi
  app.post("/api/pieces/:id/image/commit", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Non autorisé" });

    const pid = Number(req.params.id);
    if (!Number.isFinite(pid)) return res.status(400).json({ message: "id invalide" });

    const { displayUrl } = req.body as { displayUrl?: string };
    if (!displayUrl) return res.status(400).json({ message: "displayUrl manquant" });

    const row = await storage.setPieceImage(req.session.userId, pid, displayUrl);
    if (!row) return res.status(404).json({ message: "Pièce introuvable" });

    // si bucket privé, tu as déjà un resolver côté client/serveur pour signer à l’affichage
    row.imageUrl = resolveImageUrl(row.imageUrl ?? null);
    return res.json(row);
  });
}
