'use strict';

const AppError = require('../utils/AppError');

/**
 * Validate request bằng zod schema. Chạy TRƯỚC controller/service.
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} schemas
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    const errors = [];

    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;

      const result = schema.safeParse(req[part]);
      if (result.success) {
        // Dùng giá trị đã parse (đã coerce + áp default) thay cho raw input.
        req[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({
            field: [part, ...issue.path].filter((segment) => segment !== 'body').join('.'),
            message: issue.message,
          });
        }
      }
    }

    if (errors.length > 0) {
      return next(AppError.badRequest('Validation failed', errors));
    }
    return next();
  };
}

module.exports = { validate };
