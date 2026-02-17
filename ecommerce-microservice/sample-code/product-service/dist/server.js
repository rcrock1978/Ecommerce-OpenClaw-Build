"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const http_1 = require("http");
const app_1 = require("./config/app");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./middleware/metrics");
const tracing_1 = require("./middleware/tracing");
const error_handler_1 = require("./middleware/error-handler");
const request_logger_1 = require("./middleware/request-logger");
const rate_limiter_1 = require("./middleware/rate-limiter");
const auth_1 = require("./middleware/auth");
// Routes
const products_1 = __importDefault(require("./routes/products"));
const categories_1 = __importDefault(require("./routes/categories"));
const search_1 = __importDefault(require("./routes/search"));
// Database
const connection_1 = require("./database/connection");
// Tracing
require("./utils/tracing");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
}));
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging and tracing
app.use(request_logger_1.requestLogger);
app.use(tracing_1.tracingMiddleware);
// Health check (before auth)
app.get('/health/live', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/ready', async (req, res) => {
    try {
        // Check database connectivity
        const mongoose = (await Promise.resolve().then(() => __importStar(require('mongoose')))).connection;
        const isDbReady = mongoose.readyState === 1;
        if (isDbReady) {
            res.status(200).json({
                status: 'ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'connected',
                    elasticsearch: 'connected' // TODO: Add ES health check
                }
            });
        }
        else {
            res.status(503).json({
                status: 'not ready',
                timestamp: new Date().toISOString(),
                services: {
                    database: 'disconnected'
                }
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Health check failed', { error: error.message });
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});
// Metrics endpoint
app.get('/metrics', metrics_1.metricsMiddleware, metrics_1.metricsEndpoint);
// Rate limiting
app.use(rate_limiter_1.rateLimiter);
// Authentication
app.use(auth_1.authMiddleware);
// API Routes
app.use('/api/v1/products', products_1.default);
app.use('/api/v1/categories', categories_1.default);
app.use('/api/v1/search', search_1.default);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: 'Route not found',
            path: req.originalUrl
        }
    });
});
// Error handling
app.use(error_handler_1.errorHandler);
// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger_1.logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(async () => {
        logger_1.logger.info('HTTP server closed');
        try {
            const mongoose = (await Promise.resolve().then(() => __importStar(require('mongoose')))).default;
            await mongoose.connection.close();
            logger_1.logger.info('Database connection closed');
            process.exit(0);
        }
        catch (error) {
            logger_1.logger.error('Error during shutdown', { error: error.message });
            process.exit(1);
        }
    });
    // Force shutdown after 30 seconds
    setTimeout(() => {
        logger_1.logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Start server
const startServer = async () => {
    try {
        // Connect to database
        await (0, connection_1.connectDatabase)();
        // Start HTTP server
        server.listen(app_1.config.port, () => {
            logger_1.logger.info(`Product service listening on port ${app_1.config.port}`, {
                port: app_1.config.port,
                environment: app_1.config.env,
                version: app_1.config.version
            });
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server', { error: error.message });
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map