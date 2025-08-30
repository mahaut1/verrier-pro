import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import tls from "tls";

const {
  R2_ACCOUNT_ID,          // p.ex. "e33c4e177d3bed38cdeee11a1269a460"
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,              // p.ex. "verrierpro"
  R2_PUBLIC_BASE_URL,     // p.ex. "https://pub-<account>.r2.dev" (optionnel)
  R2_S3_ENDPOINT,         // p.ex. "https://s3.<account>.r2.cloudflarestorage.com" (optionnel)
} = process.env;

tls.DEFAULT_MIN_VERSION = "TLSv1.2";

export const R2_AVAILABLE: boolean = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET
);

export const R2_PUBLIC_READ = true;

const S3_ENDPOINT: string = (() => {
  if (R2_S3_ENDPOINT) return R2_S3_ENDPOINT.replace(/\/+$/, "");
  if (!R2_ACCOUNT_ID) return "";
  return `https://s3.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
})();

const S3_HOST = S3_ENDPOINT ? new URL(S3_ENDPOINT).host : "";

function buildNodeHandler(): NodeHttpHandler {
  const httpsAgent = new https.Agent({
    keepAlive: true,
    minVersion: "TLSv1.2",
    maxVersion: "TLSv1.3",
    servername: S3_HOST, // SNI explicite
  });
  return new NodeHttpHandler({ httpsAgent });
}

export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: S3_ENDPOINT,           // ex: https://s3.<account>.r2.cloudflarestorage.com
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID as string,
        secretAccessKey: R2_SECRET_ACCESS_KEY as string,
      },
      forcePathStyle: false,
      requestHandler: buildNodeHandler(),
    })
  : null;

function publicBaseWithBucket(): string {
  if (R2_PUBLIC_BASE_URL && R2_BUCKET) {
    const raw = R2_PUBLIC_BASE_URL.replace(/\/+$/, "");
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      const endsWithBucket = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop() === R2_BUCKET;
      if (host.startsWith("pub-") && host.endsWith(".r2.dev")) {
        return endsWithBucket ? raw : `${raw}/${R2_BUCKET}`;
      }
      return raw;
    } catch {
    }
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}`;
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
  if (!R2_AVAILABLE || !r2Client) {
    throw new Error("R2 non configuré");
  }

  const safeType = contentType && contentType.startsWith("image/")
    ? contentType
    : "image/jpeg";

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET as string,
      Key: key,
      Body: buf,
      ContentType: safeType,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  await r2Client.send(
    new HeadObjectCommand({ Bucket: R2_BUCKET as string, Key: key })
  );

  return urlFromKey(key);
}

export async function deleteFromR2ByUrl(publicUrl: string): Promise<void> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const key = keyFromUrl(publicUrl);
  await r2Client.send(
    new DeleteObjectCommand({ Bucket: R2_BUCKET as string, Key: key })
  );
}

export async function signIfNeeded(
  publicUrl: string | null,
  _ttlSeconds = 900
): Promise<string | null> {
  return publicUrl;
}

export const __R2_INTERNAL__ = {
  S3_ENDPOINT,
  S3_HOST,
  PUBLIC_BASE_WITH_BUCKET: publicBaseWithBucket(),
};
