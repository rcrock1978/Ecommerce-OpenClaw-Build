import { Request, Response, NextFunction } from 'express';
import { tracer } from '../utils/tracing';
import { Span, SpanStatusCode } from '@opentelemetry/api';

export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const span = tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.user_agent': req.get('User-Agent'),
      'net.peer.ip': req.ip,
      'correlation.id': req.correlationId,
      'user.id': (req as any).user?.id,
    },
  });

  // Set span on request for use in other middleware/services
  (req as any).span = span;

  // End span when response finishes
  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response_length': parseInt(res.get('Content-Length') || '0'),
    });

    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`,
      });
    }

    span.end();
  });

  // Handle errors
  res.on('error', (error) => {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    span.end();
  });

  next();
};