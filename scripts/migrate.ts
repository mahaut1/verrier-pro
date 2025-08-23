import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

//tester la migration en local
const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../migrations');

(async () => {
  try {
    // ⬇️ Charger db/pool APRÈS dotenv
    const { db, pool } = await import('../server/db.js');

    console.log('🚀 Applying migrations from', migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log('✅ Migrations applied');

    await pool.end();
  } catch (e) {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  }
})();
