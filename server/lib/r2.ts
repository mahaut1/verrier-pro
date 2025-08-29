import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import tls from "tls";
import dns from "dns";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_S3_ENDPOINT,
  R2_PUBLIC_BASE_URL,
} = process.env;

tls.DEFAULT_MIN_VERSION = "TLSv1.2";

try {
  // node ≥ 18
  // @ts-ignore
  dns.setDefaultResultOrder?.("ipv4first");
} catch { /* noop */ }

export const R2_AVAILABLE = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
);

export const R2_PUBLIC_READ = false;

function requiredEnv(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function s3Endpoint(): URL {
  // Prefer explicit R2_S3_ENDPOINT if provided
  const ep = R2_S3_ENDPOINT || `https://s3.${requiredEnv("R2_ACCOUNT_ID", R2_ACCOUNT_ID)}.r2.cloudflarestorage.com`;
  return new URL(ep);
}

function buildNodeHandler() {
  const endpoint = s3Endpoint();
  const httpsAgent = new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    servername: endpoint.hostname,             // SNI match
    ALPNProtocols: ["http/1.1"],               // don’t try h2
    lookup: (host, _opts, cb) => dns.lookup(host, { family: 4 }, cb as any),
  });

  return new NodeHttpHandler({ httpsAgent, ...( { http2: false } as any ) });
}

export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: s3Endpoint().toString(),       // **S3** endpoint
      credentials: {
        accessKeyId: requiredEnv("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID),
        secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY),
      },
      forcePathStyle: true,
      requestHandler: buildNodeHandler(),
    })
  : null;

function publicBaseWithBucket(): string {
  const raw = (R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const bucket = requiredEnv("R2_BUCKET", R2_BUCKET);
  const account = requiredEnv("R2_ACCOUNT_ID", R2_ACCOUNT_ID);

  if (raw) {
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      const path = u.pathname.replace(/\/+$/, "");
      const endsWithBucket = path.split("/").filter(Boolean).pop() === bucket;
      if (host.startsWith("pub-") && host.endsWith(".r2.dev")) {
        return endsWithBucket ? raw : `${raw}/${bucket}`;
      }
      return raw; // custom domain assumed mapped already
    } catch {}
  }
  return `https://${account}.r2.cloudflarestorage.com/${bucket}`;
}

function urlFromKey(key: string): string {
  return `${publicBaseWithBucket()}/${key.replace(/^\/+/, "")}`;
}

function keyFromUrl(publicUrl: string): string {
  const base = publicBaseWithBucket().replace(/\/+$/, "");
  try {
    const u = new URL(publicUrl);
    let path = u.pathname.replace(/^\/+/, "");
    const baseUrl = new URL(base);
    const basePath = baseUrl.pathname.replace(/^\/+/, "");
    if (basePath && path.startsWith(`${basePath}/`)) {
      path = path.slice(basePath.length + 1);
    }
    return path;
  } catch {
    return publicUrl.replace(/^https?:\/\/[^/]+\/+/, "");
  }
}

export async function uploadToR2(
  key: string,
  buf: Buffer,
  contentType?: string
): Promise<string> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");

  const safeType = contentType?.startsWith("image/") ? contentType : "image/jpeg";

  await r2Client.send(new PutObjectCommand({
    Bucket: requiredEnv("R2_BUCKET", R2_BUCKET),
    Key: key,
    Body: buf,
    ContentType: safeType,
    ContentDisposition: "inline",
    CacheControl: "public, max-age=31536000, immutable",
  }));

  await r2Client.send(new HeadObjectCommand({
    Bucket: requiredEnv("R2_BUCKET", R2_BUCKET),
    Key: key,
  }));

  return urlFromKey(key);
}

export async function deleteFromR2ByUrl(publicUrl: string): Promise<void> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  await r2Client.send(new DeleteObjectCommand({
    Bucket: requiredEnv("R2_BUCKET", R2_BUCKET),
    Key: key,
  }));
}

export async function getSignedReadUrlFromPublicUrl(
  publicUrl: string,
  ttlSeconds = 900
): Promise<string> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  const cmd = new GetObjectCommand({
    Bucket: requiredEnv("R2_BUCKET", R2_BUCKET),
    Key: key,
  });
  return getSignedUrl(r2Client, cmd, { expiresIn: ttlSeconds });
}

export async function signIfNeeded(
  publicUrl: string | null,
  ttlSeconds = 900
): Promise<string | null> {
  if (!publicUrl) return null;
  if (R2_PUBLIC_READ) return publicUrl;
  return getSignedReadUrlFromPublicUrl(publicUrl, ttlSeconds);
}
