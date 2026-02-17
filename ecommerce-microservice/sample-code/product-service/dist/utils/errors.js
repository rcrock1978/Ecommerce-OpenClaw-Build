"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.RateLimitError = exports.ForbiddenError = exports.UnauthorizedError = exports.ConflictError = exports.NotFoundError = exports.ValidationError = exports.BaseError = void 0;
// Custom error classes
class BaseError extends Error {
    constructor(message, code, statusCode = 500, isOperational = true) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.BaseError = BaseError;
class ValidationError extends BaseError {
    constructor(message, details = []) {
        super(message, 'VALIDATION_ERROR', 400);
        this.details = details;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends BaseError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 'NOT_FOUND', 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends BaseError {
    constructor(message) {
        super(message, 'CONFLICT', 409);
    }
}
exports.ConflictError = ConflictError;
class UnauthorizedError extends BaseError {
    constructor(message = 'Unauthorized') {
        super(message, 'UNAUTHORIZED', 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends BaseError {
    constructor(message = 'Forbidden') {
        super(message, 'FORBIDDEN', 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class RateLimitError extends BaseError {
    constructor(message = 'Rate limit exceeded') {
        super(message, 'RATE_LIMIT_EXCEEDED', 429);
    }
}
exports.RateLimitError = RateLimitError;
// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errors.js.map