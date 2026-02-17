"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pg_1 = require("pg");
const logger_1 = __importDefault(require("../utils/logger"));
const pool = new pg_1.Pool({
    connectionString: process.env.DATABASE_URL,
});
async function runMigrations() {
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
        const migrationsDir = path_1.default.join(__dirname, 'migrations');
        if (!fs_1.default.existsSync(migrationsDir)) {
            logger_1.default.info('No migrations directory found');
            return;
        }
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        for (const file of files) {
            if (!executedMigrations.has(file)) {
                logger_1.default.info(`Running migration: ${file}`);
                const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf8');
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                logger_1.default.info(`Migration ${file} completed`);
            }
        }
        logger_1.default.info('All migrations completed');
    }
    catch (error) {
        await client.query('ROLLBACK');
        logger_1.default.error('Migration failed', { error });
        throw error;
    }
    finally {
        client.release();
    }
}
runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
    logger_1.default.error('Migration script failed', { error: err });
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map