import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';
import { config } from '../config/app';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
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
    return (req as any).user?.id || req.ip;
  },
  onLimitReached: (req, res) => {
    logger.warn('Rate limit exceeded', {
      correlationId: req.correlationId,
      userId: (req as any).user?.id,
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