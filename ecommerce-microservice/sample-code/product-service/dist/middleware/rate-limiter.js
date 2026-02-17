"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("../utils/logger");
const app_1 = require("../config/app");
exports.rateLimiter = (0, express_rate_limit_1.default)({
    windowMs: app_1.config.rateLimit.windowMs,
    max: app_1.config.rateLimit.max,
    message: {
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.id || req.ip;
    },
    onLimitReached: (req, res) => {
        logger_1.logger.warn('Rate limit exceeded', {
            correlationId: req.correlationId,
            userId: req.user?.id,
            ip: req.ip,
            url: req.originalUrl,
            method: req.method,
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health/live' || req.path === '/health/ready';
    },
});
//# sourceMappingURL=rate-limiter.js.map