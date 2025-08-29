// server/lib/r2.ts
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

// ===== ENV =====
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,              // ex: https://pub-<account>.r2.dev  (ou domaine custom)
} = process.env;

// Toujours forcer TLS >= 1.2 (certaines stacks sinon négocient bas et CF refuse)
tls.DEFAULT_MIN_VERSION = "TLSv1.2";

// R2 dispo ?
export const R2_AVAILABLE = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
);

// Ton bucket est privé → on garde false (sinon mets true si tu ouvres en public)
export const R2_PUBLIC_READ = false;

// Handler HTTP: forcer HTTP/1.1 et TLS 1.2+, fixer SNI (servername)
function buildNodeHandler() {
  const httpsAgent = new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    // SNI explicite (important selon environnements)
    servername: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  });

  // http2:false n’est pas typé partout → cast en any
  return new NodeHttpHandler({ httpsAgent, ...( { http2: false } as any ) });
}

// Client S3 → R2
export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
      requestHandler: buildNodeHandler(),
    })
  : null;

// ===== URL helpers =====
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
      // Domaine custom → on suppose déjà mappé au bucket
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

// ===== Ops =====
export async function uploadToR2(
  key: string,
  buf: Buffer,
  contentType?: string
): Promise<string> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const safeType = contentType?.startsWith("image/") ? contentType : "image/jpeg";

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET!,
      Key: key,
      Body: buf,
      ContentType: safeType,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
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
