import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
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