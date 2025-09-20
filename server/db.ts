import { Pool, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";
import * as tls from "tls";
import dotenv from "dotenv";
import fs from "fs";

const guessed = process.env.DOTENV_CONFIG_PATH
  ?? (process.env.NODE_ENV === "test" ? "server/.env.test" : ".env");
if (!process.env.DATABASE_URL && fs.existsSync(guessed)) {
  dotenv.config({ path: guessed });
}
const urlStr = process.env.DATABASE_URL;
if (!urlStr) throw new Error("DATABASE_URL manquante");

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProd = NODE_ENV === "production";

// Parse URL pour alimenter PoolConfig sans connectionString
const u = new URL(urlStr);
const host = u.hostname;
const port = u.port ? Number(u.port) : 5432;
const database = u.pathname.replace(/^\//, "");
const user = decodeURIComponent(u.username || "");
const password = decodeURIComponent(u.password || "");

// CA (base64 ou PEM échappé)
let caPem: string | undefined;
if (process.env.PG_CA_CERT_BASE64) {
  caPem = Buffer.from(process.env.PG_CA_CERT_BASE64, "base64").toString("utf8");
} else if (process.env.PG_CA_CERT) {
  caPem = process.env.PG_CA_CERT.replace(/\\n/g, "\n");
}

// Railway internal / local => pas de TLS
const isRailwayInternal = /railway\.internal$/i.test(host);
const isLocalHost = host === "127.0.0.1" || host === "localhost";

type TLSOpts =
  | false
  | {
      rejectUnauthorized: boolean;
      ca?: string;
      servername?: string;
      checkServerIdentity?: (host: string, cert: tls.PeerCertificate) => Error | undefined;
    };

// sslmode: disable | require | verify-ca | verify-full
const sslmode =
  (process.env.PG_SSLMODE || u.searchParams.get("sslmode") || "require").toLowerCase();

const expectedName = process.env.PG_TLS_SERVERNAME || host;

let ssl: TLSOpts;
if (isLocalHost || isRailwayInternal || sslmode === "disable") {
  ssl = false;
} else if (sslmode === "require") {
  // TLS chiffré sans vérification de la chaîne/hostname
  ssl = { rejectUnauthorized: false, servername: expectedName };
} else if (sslmode === "verify-ca") {
  if (!caPem) throw new Error("verify-ca requires PG_CA_CERT(_BASE64)");
  // Vérifie la CA, ignore la correspondance de nom
  ssl = {
    rejectUnauthorized: true,
    servername: expectedName,
    ca: caPem,
    checkServerIdentity: () => undefined,
  };
} else if (sslmode === "verify-full") {
  if (!caPem) throw new Error("verify-full requires PG_CA_CERT(_BASE64)");
  // Vérifie CA + hostname (SNI)
  ssl = {
    rejectUnauthorized: true,
    servername: expectedName,
    ca: caPem,
    checkServerIdentity: (_h, cert) => tls.checkServerIdentity(expectedName, cert),
  };
} else {
  throw new Error(`Unsupported PG_SSLMODE: ${sslmode}`);
}

// Garde-fou prod : exiger une CA quand on est en verify-*
if (isProd && ssl && (sslmode === "verify-ca" || sslmode === "verify-full") && !(ssl as any).ca) {
  throw new Error("Production verify-* requires PG_CA_CERT(_BASE64).");
}

// Logs utiles
const safeUrl = urlStr.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+@/, "$1***@");
console.log("🔌 DB target:", safeUrl);
console.log("   Env:", NODE_ENV, "| sslmode:", sslmode, "| SSL:", ssl === false ? "disabled" : "enabled");
if (ssl !== false) {
  console.log("   TLS opts:", {
    servername: (ssl as any).servername,
    hasCA: !!(ssl as any).ca,
  });
}
// ⚠️ ICI on n’utilise PAS connectionString
const poolConfig: PoolConfig = {
  host,
  port,
  database,
  user,
  password,
  ssl, // inclut servername: "localhost" si mis dans l'env
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  application_name: "verrier-pro",
};

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });

// Sanity check
(async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query(`SET statement_timeout = '10s'`);
      await client.query(`SET idle_in_transaction_session_timeout = '10s'`);
      await client.query(`SET lock_timeout = '5s'`);
      const r = await client.query("select current_user, now() as ts");
      console.log("🎯 DB OK:", r.rows[0]);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("❌ DB KO:", e instanceof Error ? e.message : e);
  }
})();

process.on("SIGTERM", async () => {
 await pool.end();
  process.exit(0);
});
process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});
