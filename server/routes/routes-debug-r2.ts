import type { Express, Request, Response } from "express";
import { r2Client } from "../lib/r2";  
import { HeadBucketCommand } from "@aws-sdk/client-s3";

export function registerDebugR2Routes(app: Express) {
  app.get("/api/debug/r2/head-bucket", async (_req: Request, res: Response) => {
    try {
      if (!r2Client) {
        return res.status(500).json({ ok: false, err: "R2 client not ready" });
      }
      const Bucket = process.env.R2_BUCKET!;
      const out = await r2Client.send(new HeadBucketCommand({ Bucket }));
      res.json({ ok: true, out });
    } catch (e: any) {
      res.status(500).json({
        ok: false,
        name: e?.name,
        code: e?.code,
        status: e?.$metadata?.httpStatusCode,
        message: e?.message,
      });
    }
  });
}
