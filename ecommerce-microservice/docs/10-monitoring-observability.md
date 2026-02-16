# 10 — Monitoring & Observability

## Overview

This document defines the monitoring and observability strategy for the e-commerce microservice platform, covering structured logging with Winston, metrics collection with Prometheus, distributed tracing with Jaeger, and centralized dashboards with Grafana. The strategy ensures comprehensive visibility into system health, performance, and user experience.

---

## Structured Logging with Winston

### Winston Configuration

**Base Logger Configuration:**
```typescript
// src/logger/index.ts
import winston from 'winston';
import path from 'path';

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
winston.addColors(colors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, correlationId, ...meta }) => {
    let log = `${timestamp} [${service || 'unknown'}] ${level}: ${message}`;
    
    if (correlationId) {
      log += ` (correlationId: ${correlationId})`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// JSON format for production
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// File format with rotation
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: jsonFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'unknown-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'exceptions.log'),
    format: fileFormat
  })
);

logger.rejections.handle(
  new winston.transports.File({ 
    filename: path.join(logsDir, 'rejections.log'),
    format: fileFormat
  })
);

export default logger;
```

### Service-Specific Logging

**HTTP Request Logging Middleware:**
```typescript
// src/middleware/request-logger.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

interface LogContext {
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  correlationId: string;
  userId?: string;
  duration?: number;
  statusCode?: number;
  contentLength?: string;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] as string || 
                        req.headers['x-request-id'] as string || 
                        generateCorrelationId();
  
  // Add correlation ID to request for use in other middleware
  req.correlationId = correlationId;
  
  // Log incoming request
  const context: LogContext = {
    method: req.method,
    url: req.originalUrl,
    userAgent: req.get('User-Agent') || 'unknown',
    ip: req.ip,
    correlationId,
    userId: (req as any).user?.id,
  };
  
  logger.http('Incoming request', context);
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const responseContext = {
      ...context,
      duration,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length'),
    };
    
    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', responseContext);
    } else {
      logger.info('Request completed', responseContext);
    }
  });
  
  next();
};

function generateCorrelationId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

**Business Logic Logging:**
```typescript
// src/services/order-service.ts
import logger from '../logger';

export class OrderService {
  async createOrder(orderData: CreateOrderData, correlationId: string): Promise<Order> {
    logger.info('Creating order', {
      correlationId,
      userId: orderData.userId,
      itemCount: orderData.items.length,
    });
    
    try {
      // Business logic here
      const order = await this.orderRepository.create(orderData);
      
      logger.info('Order created successfully', {
        correlationId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
      });
      
      return order;
    } catch (error) {
      logger.error('Failed to create order', {
        correlationId,
        userId: orderData.userId,
        error: error.message,
        stack: error.stack,
      });
      
      throw error;
    }
  }
}
```

**Error Logging:**
```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const correlationId = req.correlationId || 'unknown';
  
  // Log error with context
  logger.error('Request error', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    userId: (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    statusCode,
  });
  
  // Send error response
  res.status(statusCode).json({
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'Internal server error' : error.message,
      correlationId,
    },
  });
};
```

### Go Service Logging (Zap)

**Zap Logger Configuration:**
```go
// logger/logger.go
package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

func NewLogger(serviceName, level string) *zap.Logger {
	// Parse log level
	var zapLevel zapcore.Level
	switch level {
	case "debug":
		zapLevel = zapcore.DebugLevel
	case "info":
		zapLevel = zapcore.InfoLevel
	case "warn":
		zapLevel = zapcore.WarnLevel
	case "error":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	// Create encoder config
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "timestamp",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		FunctionKey:    zapcore.OmitKey,
		MessageKey:     "message",
		StacktraceKey:  "stacktrace",
		LineEnding:      zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	// Create file writer with rotation
	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   "./logs/payment-service.log",
		MaxSize:    10, // MB
		MaxBackups: 5,
		MaxAge:     30, // days
		Compress:   true,
	})

	// Create console writer for development
	consoleWriter := zapcore.Lock(os.Stdout)

	// Create core
	core := zapcore.NewTee(
		zapcore.NewCore(zapcore.NewJSONEncoder(encoderConfig), fileWriter, zapLevel),
		zapcore.NewCore(zapcore.NewConsoleEncoder(encoderConfig), consoleWriter, zapLevel),
	)

	// Create logger
	logger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zapcore.ErrorLevel))
	
	// Add service name
	logger = logger.With(zap.String("service", serviceName))
	
	return logger
}
```

**Payment Service Logging:**
```go
// services/payment.go
package services

import (
	"context"
	"github.com/your-org/ecommerce/logger"
)

type PaymentService struct {
	logger *zap.Logger
	// ... other fields
}

func (s *PaymentService) ProcessPayment(ctx context.Context, req *ProcessPaymentRequest) (*PaymentResponse, error) {
	correlationID := getCorrelationID(ctx)
	
	s.logger.Info("Processing payment",
		zap.String("correlation_id", correlationID),
		zap.String("order_id", req.OrderID),
		zap.Float64("amount", req.Amount),
		zap.String("currency", req.Currency),
	)
	
	// Process payment logic
	result, err := s.paymentProcessor.Charge(req)
	if err != nil {
		s.logger.Error("Payment processing failed",
			zap.String("correlation_id", correlationID),
			zap.String("order_id", req.OrderID),
			zap.Error(err),
		)
		return nil, err
	}
	
	s.logger.Info("Payment processed successfully",
		zap.String("correlation_id", correlationID),
		zap.String("payment_id", result.PaymentID),
		zap.String("status", result.Status),
	)
	
	return result, nil
}
```

---

## Metrics with Prometheus

### Application Metrics

**Prometheus Client Setup:**
```typescript
// src/metrics/index.ts
import promClient from 'prom-client';

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

export const databaseQueryDuration = new promClient.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

export const eventPublishedTotal = new promClient.Counter({
  name: 'event_published_total',
  help: 'Total number of events published',
  labelNames: ['event_type', 'service'],
  registers: [register],
});

export const eventConsumedTotal = new promClient.Counter({
  name: 'event_consumed_total',
  help: 'Total number of events consumed',
  labelNames: ['event_type', 'service', 'status'],
  registers: [register],
});

export const businessMetrics = {
  ordersCreated: new promClient.Counter({
    name: 'orders_created_total',
    help: 'Total number of orders created',
    labelNames: ['currency'],
    registers: [register],
  }),
  
  paymentsProcessed: new promClient.Counter({
    name: 'payments_processed_total',
    help: 'Total number of payments processed',
    labelNames: ['status', 'provider'],
    registers: [register],
  }),
  
  productsViewed: new promClient.Counter({
    name: 'products_viewed_total',
    help: 'Total number of product views',
    labelNames: ['category'],
    registers: [register],
  }),
};
```

**Metrics Middleware:**
```typescript
// src/middleware/metrics-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestsTotal } from '../metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Increment request counter
  httpRequestsTotal.inc({
    method: req.method,
    route: getRoutePattern(req),
    status_code: res.statusCode.toString(),
  });
  
  // Observe request duration when response finishes
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

function getRoutePattern(req: Request): string {
  // Convert /api/v1/users/123 to /api/v1/users/:id
  return req.route?.path || req.path.replace(/\/\d+/g, '/:id');
}
```

**Database Metrics:**
```typescript
// src/database/metrics.ts
import { databaseQueryDuration } from '../metrics';

export class MetricsDatabaseWrapper {
  constructor(private db: any) {}
  
  async query(sql: string, params: any[] = []): Promise<any> {
    const start = Date.now();
    const operation = getOperationType(sql);
    const table = extractTableName(sql);
    
    try {
      const result = await this.db.query(sql, params);
      
      const duration = (Date.now() - start) / 1000;
      databaseQueryDuration.observe(
        { operation, table },
        duration
      );
      
      return result;
    } catch (error) {
      // Record failed queries too
      const duration = (Date.now() - start) / 1000;
      databaseQueryDuration.observe(
        { operation, table },
        duration
      );
      
      throw error;
    }
  }
}

function getOperationType(sql: string): string {
  const upperSql = sql.toUpperCase().trim();
  if (upperSql.startsWith('SELECT')) return 'select';
  if (upperSql.startsWith('INSERT')) return 'insert';
  if (upperSql.startsWith('UPDATE')) return 'update';
  if (upperSql.startsWith('DELETE')) return 'delete';
  return 'other';
}

function extractTableName(sql: string): string {
  // Simple regex to extract table name from basic SQL
  const match = sql.match(/\bFROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)/i);
  return match ? match[1] || match[2] || match[3] : 'unknown';
}
```

**Event Metrics:**
```typescript
// src/events/metrics-publisher.ts
import { eventPublishedTotal, eventConsumedTotal } from '../metrics';

export class MetricsEventPublisher {
  constructor(private publisher: EventPublisher) {}
  
  async publish(eventType: string, event: any): Promise<void> {
    try {
      await this.publisher.publish(eventType, event);
      
      eventPublishedTotal.inc({
        event_type: eventType,
        service: process.env.SERVICE_NAME,
      });
    } catch (error) {
      // Could add failure metrics here
      throw error;
    }
  }
}

export class MetricsEventConsumer {
  async processEvent(event: CloudEvent): Promise<void> {
    const start = Date.now();
    
    try {
      await this.businessLogic(event);
      
      eventConsumedTotal.inc({
        event_type: event.type,
        service: process.env.SERVICE_NAME,
        status: 'success',
      });
    } catch (error) {
      eventConsumedTotal.inc({
        event_type: event.type,
        service: process.env.SERVICE_NAME,
        status: 'error',
      });
      
      throw error;
    }
  }
}
```

### Kubernetes Metrics

**ServiceMonitor for Prometheus:**
```yaml
# k8s/monitoring/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ecommerce-services
  namespace: monitoring
  labels:
    app: ecommerce
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: ecommerce
  endpoints:
  - port: metrics
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
  namespaceSelector:
    matchNames:
    - ecommerce-prod
```

**Metrics Service:**
```yaml
# k8s/monitoring/metrics-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: ecommerce-metrics
  namespace: ecommerce-prod
  labels:
    app.kubernetes.io/name: ecommerce
spec:
  selector:
    app: ecommerce
  ports:
  - name: metrics
    port: 9090
    targetPort: 9090
    protocol: TCP
  type: ClusterIP
```

---

## Distributed Tracing with Jaeger

### OpenTelemetry Setup

**Tracing Configuration:**
```typescript
// src/tracing/index.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { KafkaJsInstrumentation } from '@opentelemetry/instrumentation-kafkajs';

// Configure Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://jaeger-collector:14268/api/traces',
  serviceName: process.env.SERVICE_NAME || 'unknown-service',
});

// Create tracer provider
const tracerProvider = new NodeTracerProvider({
  resource: {
    service: {
      name: process.env.SERVICE_NAME,
      version: process.env.npm_package_version,
    },
    attributes: {
      environment: process.env.NODE_ENV,
    },
  },
});

// Add span processor
tracerProvider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));

// Register instrumentations
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingPaths: ['/health', '/metrics', '/ready'],
    }),
    new PgInstrumentation(),
    new MongoDBInstrumentation(),
    new IORedisInstrumentation(),
    new KafkaJsInstrumentation(),
  ],
});

// Register tracer provider
tracerProvider.register();

// Export tracer
export const tracer = tracerProvider.getTracer(process.env.SERVICE_NAME || 'unknown-service');
```

**Tracing Middleware:**
```typescript
// src/middleware/tracing-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { tracer } from '../tracing';
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
```

**Service Tracing:**
```typescript
// src/services/order-service.ts
import { tracer } from '../tracing';

export class OrderService {
  async createOrder(orderData: CreateOrderData): Promise<Order> {
    return tracer.startActiveSpan('OrderService.createOrder', async (span) => {
      span.setAttributes({
        'order.user_id': orderData.userId,
        'order.item_count': orderData.items.length,
      });

      try {
        // Validate order
        await tracer.startActiveSpan('validateOrder', async (validateSpan) => {
          await this.validateOrder(orderData);
          validateSpan.end();
        });

        // Create order in database
        const order = await tracer.startActiveSpan('createOrderInDb', async (dbSpan) => {
          const result = await this.orderRepository.create(orderData);
          dbSpan.setAttributes({
            'db.order_id': result.id,
            'db.order_number': result.orderNumber,
          });
          dbSpan.end();
          return result;
        });

        // Publish event
        await tracer.startActiveSpan('publishOrderCreated', async (eventSpan) => {
          await this.eventPublisher.publish('order.created', {
            orderId: order.id,
            userId: order.userId,
          });
          eventSpan.end();
        });

        span.setAttributes({
          'order.id': order.id,
          'order.total_amount': order.totalAmount,
        });

        return order;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
```

### Go Service Tracing

**OpenTelemetry Go Setup:**
```go
// tracing/tracing.go
package tracing

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/contrib/instrumentation/github.com/lib/pq/otelpq"
)

func InitTracer(serviceName, jaegerEndpoint string) (*sdktrace.TracerProvider, error) {
	// Create Jaeger exporter
	exp, err := jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(jaegerEndpoint)))
	if err != nil {
		return nil, err
	}

	// Create resource
	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceNameKey.String(serviceName),
			semconv.ServiceVersionKey.String("1.0.0"),
		),
	)
	if err != nil {
		return nil, err
	}

	// Create tracer provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
	)

	otel.SetTracerProvider(tp)
	return tp, nil
}
```

**Payment Service Tracing:**
```go
// services/payment.go
import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func (s *PaymentService) ProcessPayment(ctx context.Context, req *ProcessPaymentRequest) (*PaymentResponse, error) {
	tracer := otel.Tracer("payment-service")
	
	ctx, span := tracer.Start(ctx, "PaymentService.ProcessPayment")
	defer span.End()
	
	span.SetAttributes(
		attribute.String("order.id", req.OrderID),
		attribute.Float64("payment.amount", req.Amount),
		attribute.String("payment.currency", req.Currency),
	)
	
	// Process payment with tracing
	result, err := s.processPaymentWithTracing(ctx, req)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return nil, err
	}
	
	span.SetAttributes(
		attribute.String("payment.id", result.PaymentID),
		attribute.String("payment.status", result.Status),
	)
	
	return result, nil
}

func (s *PaymentService) processPaymentWithTracing(ctx context.Context, req *ProcessPaymentRequest) (*PaymentResponse, error) {
	_, span := otel.Tracer("payment-service").Start(ctx, "processPayment")
	defer span.End()
	
	// Call external payment provider
	return s.paymentProvider.Charge(ctx, req)
}
```

---

## Dashboards with Grafana

### Key Dashboards

**Application Overview Dashboard:**
```json
{
  "dashboard": {
    "title": "E-commerce Application Overview",
    "tags": ["ecommerce", "overview"],
    "timezone": "UTC",
    "panels": [
      {
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "HTTP Request Duration",
        "type": "heatmap",
        "targets": [
          {
            "expr": "http_request_duration_seconds{quantile=\"0.95\"}",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
            "format": "percent"
          }
        ],
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": null, "color": "green" },
            { "value": 1, "color": "orange" },
            { "value": 5, "color": "red" }
          ]
        }
      },
      {
        "title": "Active Connections",
        "type": "gauge",
        "targets": [
          {
            "expr": "active_connections",
            "legendFormat": "Active connections"
          }
        ]
      }
    ]
  }
}
```

**Business Metrics Dashboard:**
```json
{
  "dashboard": {
    "title": "E-commerce Business Metrics",
    "tags": ["ecommerce", "business"],
    "panels": [
      {
        "title": "Orders Created",
        "type": "stat",
        "targets": [
          {
            "expr": "increase(orders_created_total[1h])",
            "legendFormat": "Orders per hour"
          }
        ]
      },
      {
        "title": "Revenue",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(increase(orders_created_total[1h])) by (currency)",
            "legendFormat": "{{currency}} revenue"
          }
        ]
      },
      {
        "title": "Payment Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(payments_processed_total{status=\"success\"}[5m]) / rate(payments_processed_total[5m]) * 100",
            "format": "percent"
          }
        ]
      },
      {
        "title": "Top Products Viewed",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum(products_viewed_total) by (product_id))",
            "legendFormat": "{{product_id}}"
          }
        ]
      }
    ]
  }
}
```

**Infrastructure Dashboard:**
```json
{
  "dashboard": {
    "title": "E-commerce Infrastructure",
    "tags": ["ecommerce", "infrastructure"],
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total{pod=~\".*ecommerce.*\"}[5m]) * 100",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "container_memory_usage_bytes{pod=~\".*ecommerce.*\"}",
            "legendFormat": "{{pod}}"
          }
        ]
      },
      {
        "title": "Pod Restarts",
        "type": "stat",
        "targets": [
          {
            "expr": "kube_pod_container_status_restarts_total{pod=~\".*ecommerce.*\"}",
            "legendFormat": "Restarts"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_activity_count{state=\"active\"}",
            "legendFormat": "Active connections"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

**Prometheus Alerting Rules:**
```yaml
# alert-rules.yaml
groups:
- name: ecommerce.alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status_code=~"[5][0-9][0-9]"}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value | humanizePercentage }} for service {{ $labels.service }}"

  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Slow response times detected"
      description: "95th percentile response time is {{ $value }}s for {{ $labels.service }}"

  - alert: DatabaseHighConnections
    expr: pg_stat_activity_count{state="active"} > 50
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High database connection count"
      description: "Database has {{ $value }} active connections"

  - alert: EventProcessingLag
    expr: kafka_consumergroup_lag{consumergroup=~"ecommerce-.*"} > 1000
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High event processing lag"
      description: "Consumer group {{ $labels.consumergroup }} has {{ $value }} messages lag"
```

---

## Log Aggregation with ELK Stack

### Logstash Configuration

**Logstash Pipeline:**
```ruby
# logstash/pipeline/ecommerce.conf
input {
  file {
    path => "/var/log/ecommerce/*.log"
    start_position => "beginning"
    sincedb_path => "/dev/null"
  }
}

filter {
  json {
    source => "message"
  }
  
  # Add service metadata
  mutate {
    add_field => {
      "service" => "%{[@metadata][input][file][path]}"
    }
  }
  
  # Parse timestamp
  date {
    match => ["timestamp", "ISO8601"]
    target => "@timestamp"
  }
  
  # Extract correlation ID for tracing
  grok {
    match => {
      "message" => "%{SYSLOGTIMESTAMP:timestamp} \[%{WORD:service}\] %{WORD:level}: %{GREEDYDATA:message} \(correlationId: %{UUID:correlation_id}\)"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "ecommerce-%{+YYYY.MM.dd}"
  }
  
  # Send errors to separate index
  if [level] == "error" {
    elasticsearch {
      hosts => ["elasticsearch:9200"]
      index => "ecommerce-errors-%{+YYYY.MM.dd}"
    }
  }
}
```

### Kibana Dashboards

**Error Monitoring Dashboard:**
- Filter: `level: error`
- Visualizations:
  - Error count over time
  - Top error messages
  - Errors by service
  - Error correlation with traces

**Performance Dashboard:**
- Filter: `level: info AND message: "*completed*"`
- Visualizations:
  - Average response times
  - Request count by endpoint
  - Slow queries (>1s)
  - User activity patterns

---

This observability stack provides comprehensive monitoring, tracing, and logging capabilities to ensure the e-commerce platform is reliable, performant, and easy to debug in production environments.