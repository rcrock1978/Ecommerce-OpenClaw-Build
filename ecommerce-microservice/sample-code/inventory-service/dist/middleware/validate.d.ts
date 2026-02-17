import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
/**
 * Factory that returns Express middleware to validate the request body
 * against a Joi schema. Aborts with 400 on validation failure.
 */
export declare function validateBody(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Validate query parameters against a Joi schema.
 */
export declare function validateQuery(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.d.ts.map