"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsEndpoint = exports.metricsMiddleware = exports.businessMetrics = exports.activeConnections = exports.httpRequestsTotal = exports.httpRequestDuration = exports.register = void 0;
const prom_client_1 = __importDefault(require("prom-client"));
// Create registry
exports.register = new prom_client_1.default.Registry();
// Add default metrics (CPU, memory, event loop lag)
prom_client_1.default.collectDefaultMetrics({ register: exports.register });
// Custom metrics
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [exports.register],
});
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [exports.register],
});
exports.activeConnections = new prom_client_1.default.Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [exports.register],
});
exports.businessMetrics = {
    productsCreated: new prom_client_1.default.Counter({
        name: 'products_created_total',
        help: 'Total number of products created',
        labelNames: ['category'],
        registers: [exports.register],
    }),
    productsViewed: new prom_client_1.default.Counter({
        name: 'products_viewed_total',
        help: 'Total number of product views',
        labelNames: ['category'],
        registers: [exports.register],
    }),
};
// Metrics middleware
const metricsMiddleware = (req, res, next) => {
    const start = Date.now();
    // Record request
    exports.httpRequestsTotal.inc({
        method: req.method,
        route: getRoutePattern(req),
        status_code: res.statusCode.toString(),
    });
    // Record duration when response finishes
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000; // Convert to seconds
        exports.httpRequestDuration.observe({
            method: req.method,
            route: getRoutePattern(req),
            status_code: res.statusCode.toString(),
        }, duration);
    });
    next();
};
exports.metricsMiddleware = metricsMiddleware;
// Metrics endpoint
const metricsEndpoint = async (req, res) => {
    try {
        const metrics = await exports.register.metrics();
        res.set('Content-Type', exports.register.contentType);
        res.send(metrics);
    }
    catch (error) {
        res.status(500).send('Error generating metrics');
    }
};
exports.metricsEndpoint = metricsEndpoint;
function getRoutePattern(req) {
    // Convert /api/v1/products/123 to /api/v1/products/:id
    return req.route?.path || req.path.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-fA-F]{24}/g, '/:id');
}
//# sourceMappingURL=metrics.js.map