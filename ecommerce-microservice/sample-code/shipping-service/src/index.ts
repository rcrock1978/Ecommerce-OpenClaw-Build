import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectKafka } from './config/kafka';
import shippingRoutes from './routes/shipping';

const app = express();
const PORT = Number(process.env.PORT ?? 3010);

// ── Global Middleware ────────────────────────────────────────────────

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// ── Routes ──────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'shipping-service', timestamp: new Date().toISOString() });
});

app.use('/api/shipping', shippingRoutes);

// ── 404 Handler ─────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Startup ─────────────────────────────────────────────────────────

async function start(): Promise<void> {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`Shipping service listening on port ${PORT}`);
  });

  // ── Graceful Shutdown ───────────────────────────────────────────

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully…`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectKafka();
      logger.info('Server closed');
      process.exit(0);
    });

    // Force exit after 10 s
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Failed to start', { error: err });
  process.exit(1);
});

export default app;