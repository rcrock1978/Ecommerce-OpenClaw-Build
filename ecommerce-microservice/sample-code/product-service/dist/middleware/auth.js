"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = exports.requireRole = exports.requirePermission = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("../config/app");
const logger_1 = require("../utils/logger");
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // No auth header - continue as anonymous user
            req.user = undefined;
            return next();
        }
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        try {
            const decoded = jsonwebtoken_1.default.verify(token, app_1.config.jwt.secret, {
                issuer: app_1.config.jwt.issuer,
                audience: app_1.config.jwt.audience,
                algorithms: ['RS256', 'HS256'] // Support both for flexibility
            });
            req.user = {
                id: decoded.sub,
                email: decoded.email,
                roles: decoded.roles || [],
                permissions: decoded.permissions || []
            };
            // Add user info to logger context
            req.logContext = {
                userId: req.user.id,
                userRoles: req.user.roles.join(',')
            };
        }
        catch (jwtError) {
            logger_1.logger.warn('Invalid JWT token', {
                error: jwtError.message,
                correlationId: req.correlationId
            });
            return res.status(401).json({
                error: {
                    code: 'INVALID_TOKEN',
                    message: 'Invalid or expired authentication token'
                }
            });
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('Authentication middleware error', {
            error: error.message,
            correlationId: req.correlationId
        });
        res.status(500).json({
            error: {
                code: 'AUTH_ERROR',
                message: 'Authentication service error'
            }
        });
    }
};
exports.authMiddleware = authMiddleware;
// Authorization middleware factory
const requirePermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required'
                }
            });
        }
        const hasPermission = req.user.permissions.includes(requiredPermission) ||
            req.user.permissions.includes('*') ||
            req.user.roles.includes('admin');
        if (!hasPermission) {
            logger_1.logger.warn('Permission denied', {
                userId: req.user.id,
                requiredPermission,
                userPermissions: req.user.permissions,
                correlationId: req.correlationId
            });
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_PERMISSIONS',
                    message: 'Insufficient permissions'
                }
            });
        }
        next();
    };
};
exports.requirePermission = requirePermission;
const requireRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: {
                    code: 'AUTHENTICATION_REQUIRED',
                    message: 'Authentication required'
                }
            });
        }
        if (!req.user.roles.includes(requiredRole) && !req.user.roles.includes('admin')) {
            logger_1.logger.warn('Role required', {
                userId: req.user.id,
                requiredRole,
                userRoles: req.user.roles,
                correlationId: req.correlationId
            });
            return res.status(403).json({
                error: {
                    code: 'INSUFFICIENT_ROLE',
                    message: `Role '${requiredRole}' required`
                }
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jsonwebtoken_1.default.verify(token, app_1.config.jwt.secret, {
                    issuer: app_1.config.jwt.issuer,
                    audience: app_1.config.jwt.audience,
                    algorithms: ['RS256', 'HS256']
                });
                req.user = {
                    id: decoded.sub,
                    email: decoded.email,
                    roles: decoded.roles || [],
                    permissions: decoded.permissions || []
                };
            }
            catch (jwtError) {
                // Invalid token - continue without user
                logger_1.logger.debug('Optional auth failed', {
                    error: jwtError.message,
                    correlationId: req.correlationId
                });
            }
        }
        next();
    }
    catch (error) {
        // Continue without authentication
        next();
    }
};
exports.optionalAuth = optionalAuth;
//# sourceMappingURL=auth.js.map