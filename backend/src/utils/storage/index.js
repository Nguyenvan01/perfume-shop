'use strict';

const env = require('../../config/env');

/**
 * Interface cố định (OD-5):
 *   upload(buffer, { filename, folder, mimetype }) → { url, public_id }
 *   destroy(public_id) → void
 *
 * Module nghiệp vụ (product-images, brands) KHÔNG được biết driver nào đang chạy.
 * Đổi `STORAGE_DRIVER` trong env là đủ, không sửa code.
 *   local      → ghi đĩa, url tương đối "/uploads/..." (chỉ dev; cấm trên Vercel)
 *   cloudinary → url tuyệt đối Cloudinary
 *   supabase   → url public tuyệt đối của Supabase Storage (production)
 */
const DRIVERS = {
  local: () => require('./local.driver'),
  cloudinary: () => require('./cloudinary.driver'),
  supabase: () =>
    require('./supabase.driver').createSupabaseDriver({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_STORAGE_BUCKET,
    }),
};

const factory = DRIVERS[env.STORAGE_DRIVER];
if (!factory) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${env.STORAGE_DRIVER}". Expected one of: ${Object.keys(DRIVERS).join(', ')}`
  );
}

// Phòng thủ thêm ngoài env.js: đĩa local trên serverless mất file sau mỗi lần invoke.
if (env.STORAGE_DRIVER === 'local' && env.isVercel) {
  throw new Error('STORAGE_DRIVER=local is not supported on Vercel (no persistent disk)');
}

module.exports = factory();
