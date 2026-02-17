"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePool = getDatabasePool;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const pg_1 = require("pg");
const logger_1 = __importDefault(require("../utils/logger"));
let pool;
function getDatabasePool() {
    if (!pool) {
        pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        pool.on('connect', () => logger_1.default.debug('Connected to PostgreSQL'));
        pool.on('error', (err) => logger_1.default.error('Unexpected PostgreSQL error', { error: err }));
    }
    return pool;
}
async function connectDatabase() {
    const pool = getDatabasePool();
    await pool.query('SELECT 1');
    logger_1.default.info('Database connected');
}
async function disconnectDatabase() {
    if (pool) {
        await pool.end();
        logger_1.default.info('Database disconnected');
    }
}
//# sourceMappingURL=database.js.map