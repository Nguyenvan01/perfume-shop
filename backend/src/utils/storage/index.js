'use strict';

const env = require('../../config/env');

/**
 * Interface cố định (OD-5):
 *   upload(buffer, { filename, folder, mimetype }) → { url, public_id }
 *   destroy(public_id) → void
 *
 * Module nghiệp vụ (product-images) KHÔNG được biết driver nào đang chạy.
 * Đổi `STORAGE_DRIVER` trong env là đủ, không sửa code.
 */
const DRIVERS = {
  local: () => require('./local.driver'),
  cloudinary: () => require('./cloudinary.driver'),
};

const factory = DRIVERS[env.STORAGE_DRIVER];
if (!factory) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}". Expected one of: ${Object.keys(DRIVERS).join(', ')}`
  );
}

module.exports = factory();
