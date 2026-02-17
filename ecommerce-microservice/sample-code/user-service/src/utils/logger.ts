import winston from 'winston';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Structured JSON logger.
 * - Production: JSON to stdout (for log aggregators like ELK / Datadog).
 * - Development: colourised human-readable output.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
  defaultMeta: { service: 'user-service' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json(),
  ),
  transports: [
    new winston.transports.Console({
      format: isProduction
        ? combine(timestamp(), json())
        : combine(colorize(), simple()),
    }),
  ],
});

export default logger;