"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
/**
 * Factory that returns Express middleware to validate the request body
 * against a Joi schema. Aborts with 400 on validation failure.
 */
function validateBody(schema) {
    return (req, res, next) => {
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
function validateQuery(schema) {
    return (req, res, next) => {
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
//# sourceMappingURL=validate.js.map