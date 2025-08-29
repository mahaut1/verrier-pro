import type { Express } from "express";
import { r2Client } from "../lib/r2.js";
import { HeadBucketCommand } from "@aws-sdk/client-s3";

export function registerDebugR2Routes(app: Express) {
  app.get("/api/debug/r2/head-bucket", async (_req, res) => {
    if (!r2Client) return res.json({ ok: false, msg: "r2Client not ready" });
    try {
      const out = await r2Client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET! }));
      res.json({ ok: true, meta: out?.$metadata });
    } catch (e: any) {
      res.json({
        ok: false,
        name: e?.name,
        code: e?.code,
        message: e?.message,
        meta: e?.$metadata ?? null,
      });
    }
  });
}
