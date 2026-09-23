import { sendError } from '../utils/responseHandler.js';
import { ZodError } from 'zod';

/**
 * Middleware to validate request payload against a Zod schema
 * @param {import('zod').ZodSchema} schema
 * @param {string} source - 'body', 'query', or 'params'
 */
export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    try {
      // Validate and sanitize data
      const parsedData = schema.parse(req[source]);
      // Reassign to request to ensure sanitized data is used downstream
      req[source] = parsedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        console.error('[Zod Validation Failed]:', error.errors);
        const errors = error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Validation failed',
          errors
        });
      }
      next(error);
    }
  };
};
