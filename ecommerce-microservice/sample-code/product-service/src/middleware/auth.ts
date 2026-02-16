import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/app';
import { logger } from '../utils/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
      correlationId?: string;
      span?: any;
    }
  }
}

export interface JWTPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  scope?: string;
  iat: number;
  exp: number;
  jti: string;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No auth header - continue as anonymous user
      req.user = undefined;
      return next();
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
        algorithms: ['RS256', 'HS256'] // Support both for flexibility
      }) as JWTPayload;

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles || [],
        permissions: decoded.permissions || []
      };

      // Add user info to logger context
      (req as any).logContext = {
        userId: req.user.id,
        userRoles: req.user.roles.join(',')
      };

    } catch (jwtError) {
      logger.warn('Invalid JWT token', {
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
  } catch (error) {
    logger.error('Authentication middleware error', {
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

// Authorization middleware factory
export const requirePermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
      logger.warn('Permission denied', {
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

export const requireRole = (requiredRole: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
    }

    if (!req.user.roles.includes(requiredRole) && !req.user.roles.includes('admin')) {
      logger.warn('Role required', {
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

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const decoded = jwt.verify(token, config.jwt.secret, {
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
          algorithms: ['RS256', 'HS256']
        }) as JWTPayload;

        req.user = {
          id: decoded.sub,
          email: decoded.email,
          roles: decoded.roles || [],
          permissions: decoded.permissions || []
        };
      } catch (jwtError) {
        // Invalid token - continue without user
        logger.debug('Optional auth failed', {
          error: jwtError.message,
          correlationId: req.correlationId
        });
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};