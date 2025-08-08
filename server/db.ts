// server/db.ts
// Utilise pg (node-postgres) en local/Docker et Neon seulement si Railway/Neon est détecté.

import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from 'ws';
import * as schema from '@shared/schema';

const url = process.env.DATABASE_URL ?? '';
const isNeonOrRailway = /(neon\.tech|railway|rlwy\.net)/i.test(url);

// 👉 Par défaut on privilégie pg (local/Docker). Neon seulement si URL cloud.
const usePg = !!url && !isNeonOrRailway;

console.log('🔍 Configuration base de données:');
console.log('  DATABASE_URL:', url ? url.substring(0, 40) + '...' : 'undefined');
console.log('  usePg:', usePg);
console.log('  Neon/Railway:', isNeonOrRailway);

if (!url) {
  throw new Error('DATABASE_URL is not set');
}

let pool: any;
let db: any;

if (usePg) {
  console.log('🐳 PostgreSQL local/Docker (driver pg)');
  pool = new PgPool({
    connectionString: url,
    ssl: false, // local
    max: 5,
    connectionTimeoutMillis: 15000,
  });
  db = drizzlePg(pool, { schema });

  // Ping de santé
  setTimeout(async () => {
    try {
      await pool.query('SELECT 1');
      console.log('🎯 Test connexion PostgreSQL (pg) OK');
    } catch (e: any) {
      console.log('⚠️ Test connexion PostgreSQL (pg) KO:', e?.message ?? e);
    }
  }, 400);
} else {
  console.log('☁️ PostgreSQL Railway/Neon (driver Neon)');
  neonConfig.webSocketConstructor = ws;
  neonConfig.useSecureWebSocket = true;
  neonConfig.pipelineConnect = false;
  neonConfig.poolQueryViaFetch = true;

  pool = new NeonPool({ connectionString: url });
  db = drizzleNeon(pool, { schema });
  console.log('✅ PostgreSQL Railway/Neon configuré (Neon)');
}

export { pool, db };
