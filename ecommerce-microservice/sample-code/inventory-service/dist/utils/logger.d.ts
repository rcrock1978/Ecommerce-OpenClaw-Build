import winston from 'winston';
/**
 * Structured JSON logger.
 * - Production: JSON to stdout (for log aggregators like ELK / Datadog).
 * - Development: colourised human-readable output.
 */
declare const logger: winston.Logger;
export default logger;
//# sourceMappingURL=logger.d.ts.map