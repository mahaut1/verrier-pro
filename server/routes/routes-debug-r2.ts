// server/routes/routes-debug-r2.ts
import type { Express } from "express";
import { r2Client } from "../lib/r2.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import dns from "node:dns";
import https from "node:https";

// --- Helpers / ENV -----------------------------------------------------------
const ACCOUNT = process.env.R2_ACCOUNT_ID ?? "";
const BUCKET  = process.env.R2_BUCKET ?? "";
// Si tu as R2_S3_ENDPOINT en env on le prend, sinon on reconstruit.
const ENDPOINT =
  process.env.R2_S3_ENDPOINT ||
  (ACCOUNT ? `https://${ACCOUNT}.r2.cloudflarestorage.com` : "");

function endpointHost(): string | null {
  try {
    return new URL(ENDPOINT).hostname;
  } catch {
    return null;
  }
}

// --- Types pour /tls ----------------------------------------------------------
type TlsOk = {
  ok: true;
  statusCode?: number;
  headers?: import("http").IncomingHttpHeaders;
  protocol: string; // indicatif
};
type TlsErr = { ok: false; name?: string; code?: string; message: string };
type TlsProbeResult = TlsOk | TlsErr;

// --- Route registrar ----------------------------------------------------------
export function registerDebugR2Routes(app: Express) {
  // 1) Ping API S3 via SDK (HEAD Bucket)
  app.get("/api/debug/r2/head-bucket", async (_req, res) => {
    if (!r2Client) {
      return res.json({ ok: false, message: "r2Client not ready" });
    }
    if (!BUCKET) {
      return res.json({ ok: false, message: "R2_BUCKET missing" });
    }
    try {
      const out = await r2Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      res.json({ ok: true, meta: out?.$metadata ?? null });
    } catch (e: any) {
      res.json({
        ok: false,
        name: e?.name,
        code: e?.code,
        message: String(e?.message || e),
        meta: e?.$metadata ?? null,
      });
    }
  });

  // 2) DNS sur l’endpoint (A / AAAA)
  app.get("/api/debug/r2/dns", async (_req, res) => {
    const host = endpointHost();
    if (!host) return res.json({ ok: false, message: "Invalid ENDPOINT", endpoint: ENDPOINT });

    const result: { A: string[]; AAAA: string[] } = { A: [], AAAA: [] };
    try {
      const v4 = await dns.promises.resolve4(host, { ttl: false });
      result.A = (Array.isArray(v4) ? v4 : []) as string[];
    } catch {}
    try {
      const v6 = await dns.promises.resolve6(host, { ttl: false });
      result.AAAA = (Array.isArray(v6) ? v6 : []) as string[];
    } catch {}

    res.json({ endpoint: ENDPOINT, host, ...result });
  });

  // 3) Handshake TLS direct (HTTPS HEAD /, HTTP/1.1 forcé)
  app.get("/api/debug/r2/tls", async (_req, res) => {
    const host = endpointHost();
    if (!host) return res.json({ ok: false, message: "Invalid ENDPOINT", endpoint: ENDPOINT });

    const url = new URL(ENDPOINT);

    const agent = new https.Agent({
      keepAlive: false,
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.3",
      servername: host,            // SNI explicite
      ALPNProtocols: ["http/1.1"], // Préférence HTTP/1.1
    });

    const opts: https.RequestOptions = {
      protocol: url.protocol,
      host,
      port: url.port || 443,
      method: "HEAD",
      path: "/",
      agent,
      headers: { Host: host },
      // Force IPv4 pour éviter certains soucis réseau
      lookup: (hostname, _options, cb) => dns.lookup(hostname, { family: 4 }, cb as any),
    };

    const result: TlsProbeResult = await new Promise<TlsProbeResult>((resolve) => {
      const req = https.request(opts, (resp) => {
        resolve({
          ok: true,
          statusCode: resp.statusCode,
          headers: resp.headers,
          protocol: "https.request (HTTP/1.1)",
        });
        resp.resume();
      });
      req.on("error", (err: any) => {
        resolve({
          ok: false,
          name: err?.name,
          code: err?.code,
          message: String(err?.message || err),
        });
      });
      req.end();
    });

    res.json({ endpoint: ENDPOINT, host, result });
  });
}
