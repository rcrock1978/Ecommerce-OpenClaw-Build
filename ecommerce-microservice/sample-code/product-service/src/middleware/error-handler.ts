import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { BaseError, ValidationError } from '../utils/errors';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const correlationId = req.correlationId || 'unknown';
  const isOperational = (error as any).isOperational !== false;

  // Log error
  logger.error('Request error', {
    correlationId,
    method: req.method,
    url: req.originalUrl,
    userId: (req as any).user?.id,
    ip: req.ip,
    error: {
      name: error.name,
      message: error.message,
      stack: isOperational ? error.stack : undefined, // Only log stack for operational errors
    },
  });

  // Handle specific error types
  if (error instanceof BaseError) {
    const statusCode = error.statusCode;
    const response: any = {
      error: {
        code: error.code,
        message: error.message,
        correlationId,
      },
    };

    // Add validation details for validation errors
    if (error instanceof ValidationError) {
      response.error.details = error.details;
    }

    return res.status(statusCode).json(response);
  }

  // Handle mongoose validation errors
  if (error.name === 'ValidationError') {
    const mongooseError = error as any;
    const details = Object.values(mongooseError.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
    }));

    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
        correlationId,
      },
    });
  }

  // Handle mongoose cast errors (invalid ObjectId)
  if (error.name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid resource ID format',
        correlationId,
      },
    });
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token',
        correlationId,
      },
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: {
        code: 'TOKEN_EXPIRED',
        message: 'Authentication token has expired',
        correlationId,
      },
    });
  }

  // Default error response
  const statusCode = isOperational ? 500 : 500;
  const message = isOperational ? 'Internal server error' : error.message;

  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
      correlationId,
    },
  });
};