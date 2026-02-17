"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracer = void 0;
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const sdk_trace_base_1 = require("@opentelemetry/sdk-trace-base");
const exporter_jaeger_1 = require("@opentelemetry/exporter-jaeger");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const instrumentation_http_1 = require("@opentelemetry/instrumentation-http");
const instrumentation_mongodb_1 = require("@opentelemetry/instrumentation-mongodb");
const instrumentation_ioredis_1 = require("@opentelemetry/instrumentation-ioredis");
const app_1 = require("../config/app");
// Create Jaeger exporter
const jaegerExporter = new exporter_jaeger_1.JaegerExporter({
    endpoint: app_1.config.tracing.jaeger.endpoint,
    serviceName: 'product-service',
});
// Create tracer provider
const tracerProvider = new sdk_trace_node_1.NodeTracerProvider({
    resource: {
        service: {
            name: 'product-service',
            version: app_1.config.version,
        },
        attributes: {
            environment: app_1.config.env,
        },
    },
});
// Add span processor
tracerProvider.addSpanProcessor(new sdk_trace_base_1.SimpleSpanProcessor(jaegerExporter));
// Register instrumentations
(0, instrumentation_1.registerInstrumentations)({
    instrumentations: [
        new instrumentation_http_1.HttpInstrumentation({
            ignoreIncomingPaths: ['/health', '/metrics'],
        }),
        new instrumentation_mongodb_1.MongoDBInstrumentation(),
        new instrumentation_ioredis_1.IORedisInstrumentation(),
    ],
});
// Register tracer provider
tracerProvider.register();
// Export tracer
exports.tracer = tracerProvider.getTracer('product-service');
//# sourceMappingURL=tracing.js.map