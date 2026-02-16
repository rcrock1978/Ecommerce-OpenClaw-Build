import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';

import { config } from './config/app';
import { logger } from './utils/logger';
import { metricsMiddleware, metricsEndpoint } from './middleware/metrics';
import { tracingMiddleware } from './middleware/tracing';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { rateLimiter } from './middleware/rate-limiter';
import { authMiddleware } from './middleware/auth';

// Routes
import productRoutes from './routes/products';
import categoryRoutes from './routes/categories';
import searchRoutes from './routes/search';

// Database
import { connectDatabase } from './database/connection';

// Tracing
import './utils/tracing';

const app = express();
const server = createServer(app);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging and tracing
app.use(requestLogger);
app.use(tracingMiddleware);

// Health check (before auth)
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/health/ready', async (req, res) => {
  try {
    // Check database connectivity
    const mongoose = (await import('mongoose')).connection;
    const isDbReady = mongoose.readyState === 1;

    if (isDbReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        services: {
          database: 'connected',
          elasticsearch: 'connected' // TODO: Add ES health check
        }
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        services: {
          database: 'disconnected'
        }
      });
    }
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Metrics endpoint
app.get('/metrics', metricsMiddleware, metricsEndpoint);

// Rate limiting
app.use(rateLimiter);

// Authentication
app.use(authMiddleware);

// API Routes
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/search', searchRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
      path: req.originalUrl
    }
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.connection.close();
      logger.info('Database connection closed');

      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    server.listen(config.port, () => {
      logger.info(`Product service listening on port ${config.port}`, {
        port: config.port,
        environment: config.env,
        version: config.version
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

export default app;