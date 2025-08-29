import type { Express, RequestHandler } from "express";
import dns from "dns";
import tls from "tls";
import { r2Client } from "../lib/r2.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

const hostA = (h:string)=> new Promise((res,rej)=>dns.resolve4(h,(e,a)=>e?rej(e):res(a)));
const hostAAAA = (h:string)=> new Promise((res,rej)=>dns.resolve6(h,(e,a)=>e?rej(e):res(a)));

export function registerDebugR2Routes(app: Express, requireAuth: RequestHandler) {
  // 1) DNS du endpoint qu'on utilise réellement
  app.get("/api/debug/r2/dns", requireAuth, async (_req, res) => {
    try {
      const ep = (process.env.R2_S3_ENDPOINT || `https://s3.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/,"");
      const host = new URL(ep).hostname;
      const a = await hostA(host).catch(e => ({ error: String(e) }));
      const aaaa = await hostAAAA(host).catch(e => ({ error: String(e) }));
      res.json({ endpoint: ep, host, A: a, AAAA: aaaa });
    } catch (e:any) {
      res.json({ error: true, name: e?.name, message: e?.message });
    }
  });

  // 2) TLS nu (sans AWS SDK) pour voir ALPN/cipher/IP family
  app.get("/api/debug/r2/tls", requireAuth, async (_req, res) => {
    const ep = (process.env.R2_S3_ENDPOINT || `https://s3.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`).replace(/\/+$/,"");
    const host = new URL(ep).hostname;
    const out:any = { host, ok:false };
    try {
      await new Promise<void>((resolve, reject) => {
        const sock = tls.connect({
          host,
          port: 443,
          minVersion: "TLSv1.2",
          maxVersion: "TLSv1.3",
          servername: host,            // SNI
          ALPNProtocols: ["h2","http/1.1"],
        }, () => {
          out.ok = true;
          out.alpnProtocol = sock.alpnProtocol;
          out.cipher = sock.getCipher();
          out.remoteAddress = sock.remoteAddress;
          out.authorized = sock.authorized;
          out.authorizationError = sock.authorizationError || null;
          sock.end();
          resolve();
        });
        sock.on("error", (err) => {
          out.ok = false;
          out.error = String(err);
          reject(err);
        });
      });
    } catch {}
    res.json(out);
  });

  // 3) HeadBucket via le SDK (ce que fait ton /head-bucket actuel)
  app.get("/api/debug/r2/head-bucket", requireAuth, async (_req, res) => {
    try {
      await r2Client!.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET! }));
      res.json({ ok: true });
    } catch (e:any) {
      res.json({ ok:false, name: e?.name, code: e?.code, message: e?.message, meta: e?.$metadata });
    }
  });
}
