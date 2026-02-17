"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const logger_1 = __importDefault(require("./utils/logger"));
const database_1 = require("./config/database");
const kafka_1 = require("./config/kafka");
const inventory_1 = __importDefault(require("./routes/inventory"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT ?? 3003);
// ── Global Middleware ────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(express_1.default.json({ limit: '1mb' }));
// Request logging
app.use((req, _res, next) => {
    logger_1.default.debug(`${req.method} ${req.path}`, { ip: req.ip });
    next();
});
// ── Routes ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});
app.use('/api/inventory', inventory_1.default);
// ── 404 Handler ─────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});
// ── Global Error Handler ────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    logger_1.default.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ success: false, message: 'Internal server error' });
});
// ── Startup ─────────────────────────────────────────────────────────
async function start() {
    await (0, database_1.connectDatabase)();
    const server = app.listen(PORT, () => {
        logger_1.default.info(`Inventory service listening on port ${PORT}`);
    });
    // ── Graceful Shutdown ───────────────────────────────────────────
    const shutdown = async (signal) => {
        logger_1.default.info(`Received ${signal}, shutting down gracefully…`);
        server.close(async () => {
            await (0, database_1.disconnectDatabase)();
            await (0, kafka_1.disconnectKafka)();
            logger_1.default.info('Server closed');
            process.exit(0);
        });
        // Force exit after 10 s
        setTimeout(() => {
            logger_1.default.warn('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000);
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
start().catch((err) => {
    logger_1.default.error('Failed to start', { error: err });
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=index.js.map