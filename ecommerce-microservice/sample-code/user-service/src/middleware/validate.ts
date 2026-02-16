import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Factory that returns Express middleware to validate the request body
 * against a Joi schema. Aborts with 400 on validation failure.
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      res.status(400).json({ success: false, message: 'Validation error', details });
      return;
    }

    req.body = value;
    next();
  };
}

/**
 * Validate query parameters against a Joi schema.
 */
export function validateQuery(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => d.message);
      res.status(400).json({ success: false, message: 'Validation error', details });
      return;
    }

    req.query = value;
    next();
  };
}
