import { Pool, PoolConfig } from 'pg';
import logger from '../utils/logger';

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'users',
  user: process.env.DB_USER ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  max: Number(process.env.DB_POOL_MAX ?? 20),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
};

/** Shared connection pool — import and use directly. */
const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected idle-client error', { error: err.message });
});

pool.on('connect', () => {
  logger.debug('New database client connected');
});

/**
 * Verify the database is reachable. Call once at startup.
 */
export async function connectDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    logger.info('Database connection verified');
  } finally {
    client.release();
  }
}

/**
 * Drain the pool gracefully. Call during shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await pool.end();
  logger.info('Database pool closed');
}

export default pool;
