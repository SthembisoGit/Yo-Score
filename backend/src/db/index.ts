import { Pool } from 'pg';
import { createHash } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const isLocalDatabase =
  config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: isLocalDatabase ? undefined : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX ?? 20),
  min: Number(process.env.PG_POOL_MIN ?? 2),
  allowExitOnIdle: false,
  keepAlive: true,
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS ?? 10000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30000),
  query_timeout: Number(process.env.PG_QUERY_TIMEOUT_MS ?? 15000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 20000),
});

pool.on('error', (err) => {
  logger.error('Database connection error', { error: err });
});

// Export query function
const slowQueryThresholdMs = Number(process.env.PG_SLOW_QUERY_MS ?? 800);
const statementFingerprint = (statement: string): string =>
  createHash('sha256').update(statement.trim()).digest('hex').slice(0, 16);

export const query = async (text: string, params?: any[]) => {
  const start = process.hrtime.bigint();
  try {
    const result = await pool.query(text, params);
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    if (durationMs >= slowQueryThresholdMs) {
      logger.warn('Slow database query detected', {
        statement_hash: statementFingerprint(text),
        duration_ms: Math.round(durationMs),
        row_count: result.rowCount,
      });
    }
    return result;
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    logger.error('Database query failed', {
      statement_hash: statementFingerprint(text),
      duration_ms: Math.round(durationMs),
      error,
    });
    throw error;
  }
};

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
