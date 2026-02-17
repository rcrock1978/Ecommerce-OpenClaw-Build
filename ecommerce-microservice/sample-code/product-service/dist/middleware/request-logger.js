"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = void 0;
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const requestLogger = (req, res, next) => {
    // Generate correlation ID if not present
    const correlationId = req.headers['x-correlation-id'] ||
        req.headers['x-request-id'] ||
        (0, uuid_1.v4)();
    req.correlationId = correlationId;
    // Add correlation ID to response headers
    res.set('X-Correlation-ID', correlationId);
    // Log incoming request
    logger_1.logger.http('Incoming request', {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        userId: req.user?.id,
    });
    // Log response when finished
    res.on('finish', () => {
        const duration = Date.now() - req.startTime;
        if (res.statusCode >= 400) {
            logger_1.logger.warn('Request completed with error', {
                correlationId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration,
                userId: req.user?.id,
            });
        }
        else {
            logger_1.logger.info('Request completed', {
                correlationId,
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode,
                duration,
                userId: req.user?.id,
            });
        }
    });
    // Set start time for duration calculation
    req.startTime = Date.now();
    next();
};
exports.requestLogger = requestLogger;
//# sourceMappingURL=request-logger.js.map