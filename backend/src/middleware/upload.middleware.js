'use strict';

const multer = require('multer');
const AppError = require('../utils/AppError');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_FILES = 5;

/**
 * Chỉ nhận ảnh raster. KHÔNG nhận SVG: SVG có thể chứa script, mà file upload
 * được serve từ cùng origin với app → rủi ro XSS.
 */
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Giữ file trong memory rồi đẩy thẳng sang storage driver, không ghi file tạm. */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
  fileFilter(_req, file, callback) {
    if (!ALLOWED_MIMETYPES.includes(file.mimetype)) {
      return callback(
        AppError.badRequest(`Invalid file type. Allowed: ${ALLOWED_MIMETYPES.join(', ')}`)
      );
    }
    return callback(null, true);
  },
});

/** Bọc multer để lỗi của nó thành AppError đúng status thay vì 500. */
function uploadImages(fieldName = 'files') {
  const handler = imageUpload.array(fieldName, MAX_FILES);
  return (req, res, next) =>
    handler(req, res, (error) => {
      if (!error) return next();
      if (error instanceof AppError) return next(error);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(AppError.badRequest('File too large. Maximum size is 2MB'));
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        return next(AppError.badRequest(`Too many files. Maximum is ${MAX_FILES}`));
      }
      if (error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(AppError.badRequest(`Unexpected field. Use "${fieldName}"`));
      }
      return next(error);
    });
}

module.exports = { uploadImages, MAX_FILE_SIZE, MAX_FILES, ALLOWED_MIMETYPES };
