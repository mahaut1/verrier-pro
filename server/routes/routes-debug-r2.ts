// server/routes/routes-debug-r2.ts
import type { Express, Request, Response } from "express";
import tls from "tls";
import https from "https";
import dns from "dns";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { r2Client, __R2_INTERNAL__ } from "../lib/r2.js";

export function registerDebugR2Routes(app: Express) {
  // 1) DNS: montre A/AAAA
  app.get("/api/debug/r2/dns", async (_req: Request, res: Response) => {
    const host = __R2_INTERNAL__.S3_HOST;
    try {
      const [a, aaaa] = await Promise.all([
        new Promise<string[]>((ok, ko) =>
          dns.resolve4(host, (e, v) => (e ? ko(e) : ok(v)))
        ),
        new Promise<string[]>((ok, ko) =>
          dns.resolve6(host, (e, v) => (e ? ko(e) : ok(v)))
        ).catch(() => [] as string[]),
      ]);
      res.json({ endpoint: __R2_INTERNAL__.S3_ENDPOINT, host, A: a, AAAA: aaaa });
    } catch (e: any) {
      res.json({ endpoint: __R2_INTERNAL__.S3_ENDPOINT, host, error: String(e?.message || e) });
    }
  });

  // 2) TLS direct (force IPv4)
  app.get("/api/debug/r2/tls", async (_req: Request, res: Response) => {
    const host = __R2_INTERNAL__.S3_HOST;
    const start = Date.now();
    try {
      const socket = tls.connect({
        host,
        port: 443,
        servername: host,              // SNI
        minVersion: "TLSv1.2",
        maxVersion: "TLSv1.3",
        ALPNProtocols: ["http/1.1"],   // évite h2
        // Forcer IPv4 en résolvant nous-mêmes :
        lookup: (h, _o, cb) => dns.lookup(h, { family: 4, all: false }, cb as any),
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
    } catch (e: any) {
      res.json({ ok: false, error: String(e?.message || e) });
    }
  });

  // 3) HeadBucket via SDK
  app.get("/api/debug/r2/head-bucket", async (_req: Request, res: Response) => {
    if (!r2Client) return res.json({ ok: false, msg: "r2Client not ready" });
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
  });
}
