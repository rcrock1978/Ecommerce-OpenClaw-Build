"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tracingMiddleware = void 0;
const tracing_1 = require("../utils/tracing");
const api_1 = require("@opentelemetry/api");
const tracingMiddleware = (req, res, next) => {
    const span = tracing_1.tracer.startSpan(`${req.method} ${req.route?.path || req.path}`, {
        attributes: {
            'http.method': req.method,
            'http.url': req.originalUrl,
            'http.user_agent': req.get('User-Agent'),
            'net.peer.ip': req.ip,
            'correlation.id': req.correlationId,
            'user.id': req.user?.id,
        },
    });
    // Set span on request for use in other middleware/services
    req.span = span;
    // End span when response finishes
    res.on('finish', () => {
        span.setAttributes({
            'http.status_code': res.statusCode,
            'http.response_length': parseInt(res.get('Content-Length') || '0'),
        });
        if (res.statusCode >= 400) {
            span.setStatus({
                code: api_1.SpanStatusCode.ERROR,
                message: `HTTP ${res.statusCode}`,
            });
        }
        span.end();
    });
    // Handle errors
    res.on('error', (error) => {
        span.recordException(error);
        span.setStatus({
            code: api_1.SpanStatusCode.ERROR,
            message: error.message,
        });
        span.end();
    });
    next();
};
exports.tracingMiddleware = tracingMiddleware;
//# sourceMappingURL=tracing.js.map