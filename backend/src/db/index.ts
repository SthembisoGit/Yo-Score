import { Pool } from 'pg';
import { config } from '../config';

const isLocalDatabase =
  config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 10000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS ?? 15000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 20000),
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Export query function
export const query = (text: string, params?: any[]) => pool.query(text, params);

// Export transaction helper
export const transaction = async (callback: (client: any) => Promise<void>) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await callback(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Export pool as default
export default pool;
