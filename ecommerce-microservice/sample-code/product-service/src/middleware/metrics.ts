import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';
import { config } from '../config/app';

// Create registry
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, event loop lag)
promClient.collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register],
});

export const businessMetrics = {
  productsCreated: new promClient.Counter({
    name: 'products_created_total',
    help: 'Total number of products created',
    labelNames: ['category'],
    registers: [register],
  }),

  productsViewed: new promClient.Counter({
    name: 'products_viewed_total',
    help: 'Total number of product views',
    labelNames: ['category'],
    registers: [register],
  }),
};

// Metrics middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Record request
  httpRequestsTotal.inc({
    method: req.method,
    route: getRoutePattern(req),
    status_code: res.statusCode.toString(),
  });

  // Record duration when response finishes
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000; // Convert to seconds

    httpRequestDuration.observe(
      {
        method: req.method,
        route: getRoutePattern(req),
        status_code: res.statusCode.toString(),
      },
      duration
    );
  });

  next();
};

// Metrics endpoint
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    const metrics = await register.metrics();
    res.set('Content-Type', register.contentType);
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
};

function getRoutePattern(req: Request): string {
  // Convert /api/v1/products/123 to /api/v1/products/:id
  return req.route?.path || req.path.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-fA-F]{24}/g, '/:id');
}