import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");

const NODE_ENV = process.env.NODE_ENV ?? "development";
const isProd = NODE_ENV === "production";

const isLocal = /localhost|127\.0\.0\.1/.test(url);
const isRailwayPublic = /rlwy\.net|proxy\.rlwy\.net/i.test(url);
const isRailwayInternal = /railway\.internal/i.test(url);


const allowInsecureDev = process.env.ALLOW_INSECURE_SSL === "1";
const ssl =
  isRailwayInternal ? false :
  isRailwayPublic ? (isProd ? { rejectUnauthorized: true } : (allowInsecureDev ? { rejectUnauthorized: false } : { rejectUnauthorized: true })) :
  false;

// Masque le mot de passe
const safeUrl = url.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+@/, "$1***@");
console.log("🔌 DB target:", safeUrl);
console.log("   Env:", NODE_ENV, "| SSL:", JSON.stringify(ssl) || false);

export const pool = new Pool({
  connectionString: url,
  ssl: ssl as any,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
  application_name: "verrier-pro",
});

export const db = drizzle(pool, { schema });

// Sécurité PG au niveau session (timeouts)
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
  } catch (e: any) {
    console.error("❌ DB KO:", e?.message ?? e);
  }
})();

process.on("SIGTERM", async () => {
  try { await pool.end(); } finally { process.exit(0); }
});
process.on("SIGINT", async () => {
  try { await pool.end(); } finally { process.exit(0); }
});
