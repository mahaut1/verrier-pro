// test-node-pg.ts
import { Pool } from 'pg';

const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,            
  user: 'appuser',
  password: 'test1234',
  database: 'verrierpro',
  ssl: false,
});

(async () => {
  try {
    const r = await pool.query('SELECT current_user, inet_client_addr() AS ip, 1 AS ok');
    console.log('OK:', r.rows[0]);
  } catch (e: any) {
    console.error('ERR code:', e.code);
    console.error('ERR message:', e.message);
  } finally {
    await pool.end();
  }
})();
