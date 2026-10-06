'use strict';

/**
 * Lỗi nghiệp vụ có chủ ý. Mọi lỗi dự đoán được phải throw AppError
 * để global error handler map đúng HTTP status, thay vì rơi vào 500.
 */
class AppError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {Array<{field?: string, message: string}>} [errors]
   */
  constructor(statusCode, message, errors = []) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors = []) {
    return new AppError(400, message, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(404, message);
  }

  static conflict(message = 'Conflict') {
    return new AppError(409, message);
  }

  static gone(message = 'Gone') {
    return new AppError(410, message);
  }

  /** 422 — request đúng cú pháp nhưng vi phạm rule nghiệp vụ (vd hết hàng). */
  static unprocessable(message = 'Unprocessable entity', errors = []) {
    return new AppError(422, message, errors);
  }
}

module.exports = AppError;
