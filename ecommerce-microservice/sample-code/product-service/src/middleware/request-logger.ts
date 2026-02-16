import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate correlation ID if not present
  const correlationId = req.headers['x-correlation-id'] as string ||
                       req.headers['x-request-id'] as string ||
                       uuidv4();

  req.correlationId = correlationId;

  // Add correlation ID to response headers
  res.set('X-Correlation-ID', correlationId);

  // Log incoming request
  logger.http('Incoming request', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - (req as any).startTime;

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: (req as any).user?.id,
      });
    } else {
      logger.info('Request completed', {
        correlationId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userId: (req as any).user?.id,
      });
    }
  });

  // Set start time for duration calculation
  (req as any).startTime = Date.now();

  next();
};