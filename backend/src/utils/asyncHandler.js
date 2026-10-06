'use strict';

/** Bọc async controller để lỗi tự chảy vào global error handler, khỏi try/catch lặp lại. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
