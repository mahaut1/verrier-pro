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
  R2_PUBLIC_BASE_URL,   // ex: https://pub-<account>.r2.dev
  R2_S3_ENDPOINT,       // ex: https://s3.<account>.r2.cloudflarestorage.com (optionnel)
} = process.env;

tls.DEFAULT_MIN_VERSION = "TLSv1.2";

const S3_ENDPOINT = ((): string => {
  if (R2_S3_ENDPOINT) return R2_S3_ENDPOINT.replace(/\/+$/, "");
  if (!R2_ACCOUNT_ID) return "";
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
})();
const S3_HOST = S3_ENDPOINT ? new URL(S3_ENDPOINT).host : "";

export const R2_AVAILABLE = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET && S3_ENDPOINT
);
export const R2_PUBLIC_READ = false;

type LookupCompat = typeof dns.lookup & { __promisify__?: unknown };

const lookupV4: LookupCompat = ((
  hostname: any,
  options?: any,
  callback?: any
) => {
  let cb = callback;
  let opts = options;
  if (typeof opts === "function") {
    cb = opts;
    opts = undefined;
  }
  dns.lookup(
    hostname,
    { ...(opts || {}), family: 4, all: false },
    cb as (err: NodeJS.ErrnoException | null, address: string, family: number) => void
  );
}) as any;

(lookupV4 as any).__promisify__ = (dns.lookup as any).__promisify__;

function buildNodeHandler() {
  const httpsAgent = new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    servername: S3_HOST,  
    lookup: lookupV4,     
  });

  return new NodeHttpHandler({
    httpsAgent,
    requestTimeout: 15_000,
    ...( { http2: false } as any ), 
  });
}

export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false, 
      requestHandler: buildNodeHandler(),
    })
  : null;

function publicBaseWithBucket(): string {
  const raw = (R2_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  const bucket = R2_BUCKET!;
  const account = R2_ACCOUNT_ID!;
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
    Bucket: R2_BUCKET!,
    Key: key,
    Body: buf,
    ContentType: safeType,
    ContentDisposition: "inline",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
  return urlFromKey(key);
}

export async function deleteFromR2ByUrl(publicUrl: string): Promise<void> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
}

export async function getSignedReadUrlFromPublicUrl(
  publicUrl: string,
  ttlSeconds = 900
): Promise<string> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key });
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

export const __R2_INTERNAL__ = { S3_ENDPOINT, S3_HOST };
