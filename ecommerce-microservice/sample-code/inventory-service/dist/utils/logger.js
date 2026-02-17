"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const { combine, timestamp, json, errors, colorize, simple } = winston_1.default.format;
const isProduction = process.env.NODE_ENV === 'production';
/**
 * Structured JSON logger.
 * - Production: JSON to stdout (for log aggregators like ELK / Datadog).
 * - Development: colourised human-readable output.
 */
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    defaultMeta: { service: 'inventory-service' },
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), json()),
    transports: [
        new winston_1.default.transports.Console({
            format: isProduction
                ? combine(timestamp(), json())
                : combine(colorize(), simple()),
        }),
    ],
});
exports.default = logger;
//# sourceMappingURL=logger.js.map