import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import tls from "tls";
import { Readable } from "node:stream";

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_S3_ENDPOINT,
} = process.env as Record<string, string | undefined>;

export const R2_AVAILABLE =
  Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

export const R2_BUCKET_NAME = (R2_BUCKET || "").trim();

// Enforce TLS >= 1.2 (notamment Windows/OpenSSL)
tls.DEFAULT_MIN_VERSION = "TLSv1.2";

// Endpoint S3-compatible (R2)
const S3_ENDPOINT = (() => {
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
    servername: S3_HOST,
  });
  return new NodeHttpHandler({ httpsAgent });
}

export const r2Client = R2_AVAILABLE
  ? new S3Client({
      region: "auto",
      endpoint: S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
      requestHandler: buildNodeHandler(),
    })
  : null;


export function sanitizeFilename(name: string): string {
  return (name || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 150);
}

export function makePieceKey(params: {
  userId: number | string;
  pieceId: number | string;
  filename: string;
}): string {
  const safe = sanitizeFilename(params.filename || "image");
  const ts = Date.now();
  return `pieces/${params.userId}/${params.pieceId}-${ts}-${safe}`;
}

function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}


export function keyFromPublicUrl(input: string): string {
  if (!input) return input;
  if (!isAbsoluteUrl(input)) return input.replace(/^https?:\/\/[^/]+\/+/, "");
  try {
    const u = new URL(input);
    let path = u.pathname.replace(/^\/+/, "");
    if (u.hostname.endsWith(".r2.cloudflarestorage.com")) {
      const segs = path.split("/");
      if (segs[0] && segs[0] === R2_BUCKET_NAME) segs.shift();
      return segs.join("/");
    }
    return path; 
  } catch {
    return input.replace(/^https?:\/\/[^/]+\/+/, "");
  }
}


export async function r2PutObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string
): Promise<{ key: string }> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  const safeType =
    contentType && /^[-\w.+]+\/[-\w.+]+$/.test(contentType)
      ? contentType
      : "application/octet-stream";

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: safeType,
      ContentDisposition: "inline",
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { key };
}

export async function r2GetObject(
  key: string
): Promise<{
  headers: {
    contentType?: string;
    cacheControl?: string;
    etag?: string;
    lastModified?: Date;
    contentLength?: number;
  };
  stream: NodeJS.ReadableStream;
}> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");

  const out: GetObjectCommandOutput = await r2Client.send(
    new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key })
  );

  const body = out.Body as unknown;

  let stream: NodeJS.ReadableStream;
  if (body && typeof (body as any as NodeJS.ReadableStream).pipe === "function") {
    stream = body as NodeJS.ReadableStream; // déjà un Readable Node (SdkStream)
  } else if (body && typeof (body as any).getReader === "function" && (Readable as any).fromWeb) {
    // ReadableStream web -> Node stream (Node >=18)
    stream = Readable.fromWeb(body as any);
  } else if (body) {
    // Fallback bufferisation (éviter pour gros objets)
    const chunks: Uint8Array[] = [];
    if (typeof (body as any)[Symbol.asyncIterator] === "function") {
      for await (const chunk of body as AsyncIterable<Uint8Array>) chunks.push(chunk);
      stream = Readable.from(Buffer.concat(chunks));
    } else {
      stream = Readable.from(Buffer.alloc(0));
    }
  } else {
    stream = Readable.from(Buffer.alloc(0));
  }

  return {
    headers: {
      contentType: out.ContentType,
      cacheControl: out.CacheControl,
      etag: out.ETag ? String(out.ETag).replace(/"/g, "") : undefined,
      lastModified: out.LastModified ? new Date(out.LastModified) : undefined,
      contentLength: typeof out.ContentLength === "number" ? out.ContentLength : undefined,
    },
    stream,
  };
}

export async function r2DeleteObject(key: string): Promise<void> {
  if (!R2_AVAILABLE || !r2Client) throw new Error("R2 non configuré");
  await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
}

export async function r2DeleteByUrl(publicUrl: string): Promise<void> {
  const key = keyFromPublicUrl(publicUrl);
  await r2DeleteObject(key);
}