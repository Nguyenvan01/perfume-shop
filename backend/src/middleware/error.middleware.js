'use strict';

const { Prisma } = require('@prisma/client');
const AppError = require('../utils/AppError');
const env = require('../config/env');

/** 404 cho route không khớp — chạy sau mọi router. */
function notFoundHandler(req, _res, next) {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

/** Map lỗi Prisma sang HTTP status có nghĩa, thay vì để rơi vào 500. */
function mapPrismaError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.join(', ')
          : error.meta?.target || 'field';
        return AppError.conflict(`Duplicate value for ${target}`);
      }
      case 'P2003':
        return AppError.conflict('Related record constraint failed');
      case 'P2025':
        return AppError.notFound(error.meta?.cause || 'Record not found');
      default:
        return null;
    }
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return AppError.badRequest('Invalid data sent to database layer');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars -- Express nhận diện error handler qua arity 4
function errorHandler(error, req, res, next) {
  let appError = error instanceof AppError ? error : mapPrismaError(error);

  if (!appError) {
    if (error?.name === 'JsonWebTokenError') {
      appError = AppError.unauthorized('Invalid token');
    } else if (error?.name === 'TokenExpiredError') {
      appError = AppError.unauthorized('Token expired');
    } else if (error?.type === 'entity.parse.failed') {
      appError = AppError.badRequest('Invalid JSON body');
    } else if (error?.code === 'LIMIT_FILE_SIZE') {
      appError = AppError.badRequest('File too large');
    }
  }

  if (!appError) {
    // Lỗi không lường trước: log full stack, nhưng không rò rỉ chi tiết ra client.
    if (!env.isTest) {
      // eslint-disable-next-line no-console
      console.error('[unhandled]', error);
    }
    appError = new AppError(500, 'Internal server error');
  }

  const body = {
    success: false,
    message: appError.message,
    errors: appError.errors || [],
  };

  if (env.isDevelopment && appError.statusCode === 500) {
    body.stack = error?.stack;
  }

  return res.status(appError.statusCode).json(body);
}

module.exports = { notFoundHandler, errorHandler };
