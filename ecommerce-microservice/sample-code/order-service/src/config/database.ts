import { Pool } from 'pg';
import logger from '../utils/logger';

let pool: Pool;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('connect', () => logger.debug('Connected to PostgreSQL'));
    pool.on('error', (err) => logger.error('Unexpected PostgreSQL error', { error: err }));
  }
  return pool;
}

export async function connectDatabase(): Promise<void> {
  const pool = getDatabasePool();
  await pool.query('SELECT 1');
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('Database disconnected');
  }
}