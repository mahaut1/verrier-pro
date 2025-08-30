import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_AVAILABLE, R2_BUCKET_NAME } from "../lib/r2.js"; // <- importe R2_BUCKET_NAME si tu veux
import { Readable } from "node:stream";

const ALLOWED_PREFIX = "pieces/"; 

function b64urlDecode(s: string): string {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  return Buffer.from(s + "=".repeat(pad), "base64").toString("utf8");
}

function normalizeKey(raw: string) {
  let k = raw.replace(/^\/+/, "");

  // si jamais on reçoit "verrierpro/…", on retire le nom du bucket
  if (R2_BUCKET_NAME && k.startsWith(R2_BUCKET_NAME + "/")) {
    k = k.slice(R2_BUCKET_NAME.length + 1);
  }

  if (k.includes("..")) {
    const err = new Error("path traversal") as any;
    err.status = 400;
    throw err;
  }
  return k; // ex: "pieces/3/1-...jpg"
}

export function registerR2ProxyRoutes(app: Express, requireAuth: RequestHandler) {
  app.get("/api/r2/object/:b64key", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!R2_AVAILABLE || !r2Client) return res.status(500).json({ message: "R2 non configuré" });

      const b64 = req.params.b64key;
      if (!b64) return res.status(400).json({ message: "Clé manquante" });

      const decoded = b64urlDecode(b64);     
      const key = normalizeKey(decoded);    

      if (!key.startsWith(ALLOWED_PREFIX)) return res.status(403).json({ message: "Accès refusé" });

      const out = await r2Client.send(new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,  
        Key: key,                
      }));

      if (!out.Body) return res.status(404).end();

      if (out.ContentType)           res.setHeader("Content-Type", out.ContentType);
      if (out.ContentLength != null) res.setHeader("Content-Length", String(out.ContentLength));
      if (out.LastModified)          res.setHeader("Last-Modified", out.LastModified.toUTCString());
      if (out.ETag)                  res.setHeader("ETag", String(out.ETag).replace(/"/g, ""));
      res.setHeader("Cache-Control", "public, max-age=86400");

      (out.Body as Readable).on("error", next).pipe(res);
    } catch (e: any) {
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
        if (!res.headersSent) return res.status(404).json({ message: "Objet introuvable" });
      }
      if (!res.headersSent) res.status(500).json({ message: "Erreur lecture R2" });
    }
  });
}
