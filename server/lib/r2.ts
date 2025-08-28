// server/lib/r2.ts
import tls from "tls";
import https from "https";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ===== ENV ===================================================================
const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL, // ex: https://pub-<account>.r2.dev (Public Dev URL) ou domaine custom
  R2_S3_ENDPOINT,     // (optionnel) permet d'écraser l'endpoint S3
} = process.env;

// TLS >= 1.2 pour éviter "ssl3 alert handshake failure" sur certains environnements
tls.DEFAULT_MIN_VERSION = "TLSv1.2";

// Bucket dispo ?
export const R2_AVAILABLE = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
);

// Si le bucket devient public, tu peux mettre true (ou exposer via env)
export const R2_PUBLIC_READ = false;

// ===== HTTP handler (force HTTP/1.1 + borne TLS) =============================
function buildNodeHandler() {
  const agent = new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    // ALPN explicite → annonce HTTP/1.1 uniquement
    ALPNProtocols: ["http/1.1"],
  });
  return new NodeHttpHandler({ httpsAgent: agent } as any);
}

// ===== S3 Client pour R2 =====================================================
const ENDPOINT_PRIMARY   = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const ENDPOINT_ALTERNATE = `https://s3.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const R2_ENDPOINT = R2_S3_ENDPOINT || ENDPOINT_PRIMARY;

export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      forcePathStyle: true,
      requestHandler: buildNodeHandler(),
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

// ===== Helpers URL ===========================================================

/**
 * Construit la base publique (pour afficher/partager) :
 * - si pub-....r2.dev → il faut /<bucket> UNE SEULE fois.
 * - si domaine custom → on ne rajoute rien.
 * - fallback API-style → https://<account>.r2.cloudflarestorage.com/<bucket>
 */
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
      return raw; // domaine custom
    } catch {
      // ignore → fallback API-style
    }
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
    // best-effort
    return publicUrl.replace(/^https?:\/\/[^/]+\/+/, "");
  }
}

// ===== Ops ===================================================================

/** Upload buffer → retourne l’URL “publique-style” à stocker en DB */
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

  // Sanity check
  await r2Client.send(new HeadObjectCommand({ Bucket: R2_BUCKET!, Key: key }));

  return urlFromKey(key);
}

/** Supprime un objet via son URL stockée */
export async function deleteFromR2ByUrl(publicUrl: string): Promise<void> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
}

/** URL GET signée (pour lecture privée) */
export async function getSignedReadUrlFromPublicUrl(
  publicUrl: string,
  ttlSeconds = 600
): Promise<string> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET!, Key: key });
  return getSignedUrl(r2Client, cmd, { expiresIn: ttlSeconds });
}

/** Renvoie une URL affichable <img> : signée si bucket privé */
export async function signIfNeeded(
  publicUrl: string | null,
  ttlSeconds = 600
): Promise<string | null> {
  if (!publicUrl) return null;
  if (R2_PUBLIC_READ) return publicUrl;
  return getSignedReadUrlFromPublicUrl(publicUrl, ttlSeconds);
}

// Export utilitaires si besoin ailleurs
export { urlFromKey, keyFromUrl, publicBaseWithBucket, ENDPOINT_PRIMARY, ENDPOINT_ALTERNATE };
