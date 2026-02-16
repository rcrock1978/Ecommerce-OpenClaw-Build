import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import logger from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create migrations table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Get executed migrations
    const result = await client.query('SELECT name FROM migrations ORDER BY id');
    const executedMigrations = new Set(result.rows.map(row => row.name));

    // Read migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.info('No migrations directory found');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!executedMigrations.has(file)) {
        logger.info(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');

        logger.info(`Migration ${file} completed`);
      }
    }

    logger.info('All migrations completed');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration script failed', { error: err });
    process.exit(1);
  });