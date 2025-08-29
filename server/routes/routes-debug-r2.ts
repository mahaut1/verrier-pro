import type { Express, Request, Response, NextFunction } from "express";
import tls from "tls";
import dns from "dns";
import {
  HeadBucketCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client, __R2_INTERNAL__, signIfNeeded } from "../lib/r2.js";

function ah(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

function publicBaseWithBucket(): string {
  const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || "";
  const bucket = process.env.R2_BUCKET!;
  const account = process.env.R2_ACCOUNT_ID!;
  const raw = R2_PUBLIC_BASE_URL.replace(/\/+$/, "");

  if (raw) {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.replace(/\/+$/, "");
      const endsWithBucket = path.split("/").filter(Boolean).pop() === bucket;
      if (host.startsWith("pub-") && host.endsWith(".r2.dev")) {
        return endsWithBucket ? raw : `${raw}/${bucket}`;
      }
      return raw;
    } catch {
    }
  }
  return `https://${account}.r2.cloudflarestorage.com/${bucket}`;
}
function urlFromKey(key: string): string {
  return `${publicBaseWithBucket()}/${String(key).replace(/^\/+/, "")}`;
}


export function registerDebugR2Routes(app: Express) {
  // 0) “whoami” : montre ce que voit le serveur (sans secrets)
  app.get("/api/debug/r2/whoami", (_req, res) => {
    const mask = (s?: string) =>
      s ? s.slice(0, 4) + "…" + s.slice(-4) : "(unset)";
    res.json({
      account: process.env.R2_ACCOUNT_ID || null,
      bucket: process.env.R2_BUCKET || null,
      s3Endpoint: __R2_INTERNAL__.S3_ENDPOINT,
      s3Host: __R2_INTERNAL__.S3_HOST,
      publicBase: process.env.R2_PUBLIC_BASE_URL || null,
      // masqués :
      accessKeyId: mask(process.env.R2_ACCESS_KEY_ID),
      secretKey: mask(process.env.R2_SECRET_ACCESS_KEY),
    });
  });

  app.get(
    "/api/debug/r2/dns",
    ah(async (_req, res) => {
      const host = __R2_INTERNAL__.S3_HOST;
      if (!host) return res.json({ error: "S3_HOST undefined" });

      const A = await new Promise<string[]>((ok, ko) =>
        dns.resolve4(host, (e, v) => (e ? ko(e) : ok(v)))
      ).catch(() => [] as string[]);

      const AAAA = await new Promise<string[]>((ok, ko) =>
        dns.resolve6(host, (e, v) => (e ? ko(e) : ok(v)))
      ).catch(() => [] as string[]);

      res.json({
        endpoint: __R2_INTERNAL__.S3_ENDPOINT,
        host,
        A,
        AAAA,
      });
    })
  );

  app.get(
    "/api/debug/r2/tls",
    ah(async (_req, res) => {
      const host = __R2_INTERNAL__.S3_HOST;
      if (!host) return res.json({ ok: false, error: "S3_HOST undefined" });
      const start = Date.now();

      const socket = tls.connect({
        host,
        port: 443,
        servername: host, 
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        ALPNProtocols: ["http/1.1"], 
        lookup: (h, _o, cb) =>
          dns.lookup(h, { family: 4, all: false }, cb as any),
      });

      socket.once("secureConnect", () => {
        const info = {
          ok: true,
          negotiatedProtocol: socket.alpnProtocol,
          cipher: socket.getCipher?.() ?? null,
          authorized: socket.authorized,
          timeMs: Date.now() - start,
        };
        socket.destroy();
        res.json(info);
      });
      socket.once("error", (err) => {
        res.json({ ok: false, error: String(err), timeMs: Date.now() - start });
      });
    })
  );

  app.get(
    "/api/debug/r2/head-bucket",
    ah(async (_req, res) => {
      if (!r2Client)
        return res.json({ ok: false, message: "r2Client not ready" });
      try {
        const out = await r2Client.send(
          new HeadBucketCommand({ Bucket: process.env.R2_BUCKET! })
        );
        res.json({ ok: true, meta: out?.$metadata });
      } catch (e: any) {
        res.json({
          ok: false,
          name: e?.name,
          code: e?.code,
          message: e?.message,
          meta: e?.$metadata ?? null,
          attempts: e?.$metadata?.attempts ?? 1,
          totalRetryDelay: e?.$metadata?.totalRetryDelay ?? 0,
        });
      }
    })
  );

  app.post(
    "/api/debug/r2/put-get",
    ah(async (_req, res) => {
      if (!r2Client)
        return res.status(500).json({ ok: false, message: "r2Client not ready" });
      const bucket = process.env.R2_BUCKET!;
      const now = new Date().toISOString().replace(/[:.]/g, "-");
      const key = `debug/${now}-hello.txt`;
      const body = Buffer.from(`Hello R2 @ ${new Date().toISOString()}\n`);

      try {
        await r2Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: "text/plain; charset=utf-8",
            ContentDisposition: "inline",
            CacheControl: "no-cache",
          })
        );

        const head = await r2Client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: key })
        );

        const publicUrl = urlFromKey(key);
        const viewUrl = await signIfNeeded(publicUrl, 900);

        res.json({
          ok: true,
          key,
          publicUrl,
          viewUrl,
          headMeta: head?.$metadata ?? null,
        });
      } catch (e: any) {
        res.status(500).json({
          ok: false,
          step: "put-get",
          name: e?.name,
          code: e?.code,
          message: e?.message,
          meta: e?.$metadata ?? null,
        });
      }
    })
  );

  app.delete(
    "/api/debug/r2/object",
    ah(async (req, res) => {
      if (!r2Client)
        return res.status(500).json({ ok: false, message: "r2Client not ready" });
      const bucket = process.env.R2_BUCKET!;
      const key = String(req.query.key || "");
      if (!key) return res.status(400).json({ ok: false, message: "key is required" });

      try {
        await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        res.json({ ok: true, deleted: key });
      } catch (e: any) {
        res.status(500).json({
          ok: false,
          step: "delete",
          name: e?.name,
          code: e?.code,
          message: e?.message,
          meta: e?.$metadata ?? null,
        });
      }
    })
  );
}
