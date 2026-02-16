import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { config } from '../config/app';

// Create Jaeger exporter
const jaegerExporter = new JaegerExporter({
  endpoint: config.tracing.jaeger.endpoint,
  serviceName: 'product-service',
});

// Create tracer provider
const tracerProvider = new NodeTracerProvider({
  resource: {
    service: {
      name: 'product-service',
      version: config.version,
    },
    attributes: {
      environment: config.env,
    },
  },
});

// Add span processor
tracerProvider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));

// Register instrumentations
registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingPaths: ['/health', '/metrics'],
    }),
    new MongoDBInstrumentation(),
    new IORedisInstrumentation(),
  ],
});

// Register tracer provider
tracerProvider.register();

// Export tracer
export const tracer = tracerProvider.getTracer('product-service');