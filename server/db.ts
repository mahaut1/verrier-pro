// server/db.ts — 100% pg (node-postgres), compatible local + Railway
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

// --- ENV ---
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante");

const forcePg = process.env.FORCE_PG === "1" || process.env.FORCE_PG === "true";

// Détection simple
const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
const isRailwayPublic = url.includes("rlwy.net") || url.includes("proxy.rlwy.net");
const isRailwayInternal = url.includes("railway.internal");

// Avec Railway on utilise TOUJOURS pg. (forcePg permet de forcer si besoin)
const mustUsePg = forcePg || isLocal || isRailwayPublic || isRailwayInternal;

// SSL: public proxy = true (mais sans vérif de cert), interne = false, local = false
const ssl =
  isRailwayPublic ? { rejectUnauthorized: false } :
  isRailwayInternal ? false :
  false;

// Log safe (masque le mot de passe)
const safeUrl = url.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+@/, "$1***@");
console.log("🔌 DB target:", safeUrl);
console.log("   Driver: pg");
console.log("   SSL:", !!ssl);

// --- Pool + Drizzle ---
export const pool = new Pool({
  connectionString: url,
  ssl: ssl as any,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});
export const db = drizzle(pool, { schema });

// Petit ping
(async () => {
  try {
    const r = await pool.query("select current_user, now() as ts");
    console.log("🎯 DB OK:", r.rows[0]);
  } catch (e: any) {
    console.error("❌ DB KO:", e?.message ?? e);
  }
})();
