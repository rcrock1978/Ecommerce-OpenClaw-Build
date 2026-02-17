"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const app_1 = require("../config/app");
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};
// Add colors to winston
winston_1.default.addColors(colors);
// Create logs directory path
const logsDir = path_1.default.join(process.cwd(), 'logs');
// Console format for development
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.colorize({ all: true }), winston_1.default.format.printf(({ timestamp, level, message, service, correlationId, userId, ...meta }) => {
    let log = `${timestamp} [${service}] ${level}: ${message}`;
    if (correlationId) {
        log += ` (correlationId: ${correlationId})`;
    }
    if (userId) {
        log += ` (userId: ${userId})`;
    }
    if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
    }
    return log;
}));
// JSON format for production
const jsonFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// File format
const fileFormat = winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
// Create winston logger instance
const logger = winston_1.default.createLogger({
    level: app_1.config.logging.level,
    levels,
    format: jsonFormat,
    defaultMeta: {
        service: 'product-service',
        version: app_1.config.version,
        environment: app_1.config.env
    },
    transports: [
        // Error log file
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        // Combined log file
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'combined.log'),
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
    ],
});
exports.logger = logger;
// Add console transport for development
if (app_1.config.env !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: consoleFormat,
    }));
}
// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(new winston_1.default.transports.File({
    filename: path_1.default.join(logsDir, 'exceptions.log'),
    format: fileFormat
}));
logger.rejections.handle(new winston_1.default.transports.File({
    filename: path_1.default.join(logsDir, 'rejections.log'),
    format: fileFormat
}));
//# sourceMappingURL=logger.js.map