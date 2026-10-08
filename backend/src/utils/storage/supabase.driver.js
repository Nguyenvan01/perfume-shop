'use strict';

const crypto = require('crypto');
const path = require('path');
const AppError = require('../AppError');

/**
 * Supabase Storage driver, gọi thẳng Storage REST API bằng `fetch` có sẵn của Node
 * (không kéo @supabase/supabase-js: chỉ cần 2 endpoint, và fetch dễ mock trong test).
 *
 * Interface giống các driver khác (xem ./index.js):
 *   upload(buffer, { filename, folder, mimetype }) → { url, public_id }
 *   destroy(public_id) → void
 *
 * `public_id` là đường dẫn object trong bucket, vd "products/<uuid>.webp".
 * Bucket phải là public để `url` trả về đọc được không cần token.
 *
 * Service role key chỉ nằm trong header request: không bao giờ đưa vào message lỗi,
 * log hay response. Lỗi upstream chỉ báo status, body lỗi không được đọc.
 */

const REQUEST_TIMEOUT_MS = 15_000;
// Tên object là UUID ngẫu nhiên, không bao giờ bị ghi đè → cache lâu được.
const CACHE_CONTROL = 'max-age=31536000';

const EXTENSION_BY_MIMETYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const FOLDER_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i;
const OBJECT_PATH_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_.-]+)*$/i;

function pickExtension(filename, mimetype) {
  if (EXTENSION_BY_MIMETYPE[mimetype]) return EXTENSION_BY_MIMETYPE[mimetype];
  const fromName = path.extname(filename || '').slice(1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(fromName) ? fromName : 'bin';
}

/** Encode từng segment, giữ dấu "/" làm phân cách. */
const encodePath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

/**
 * @param {object} config
 * @param {string} config.url              SUPABASE_URL, vd https://<ref>.supabase.co
 * @param {string} config.serviceRoleKey   SUPABASE_SERVICE_ROLE_KEY (server-only)
 * @param {string} config.bucket           SUPABASE_STORAGE_BUCKET (public bucket)
 * @param {typeof fetch} [config.fetchImpl] inject để test
 */
function createSupabaseDriver({ url, serviceRoleKey, bucket, fetchImpl } = {}) {
  if (!url || !serviceRoleKey || !bucket) {
    throw new Error(
      'Supabase storage driver requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET'
    );
  }

  const baseUrl = url.replace(/\/+$/, '');
  const bucketSegment = encodeURIComponent(bucket);
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  const authHeaders = {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };

  async function request(action, endpoint, init) {
    let response;
    try {
      response = await doFetch(endpoint, {
        ...init,
        headers: { ...authHeaders, ...init.headers },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Lỗi mạng/timeout của fetch có thể mang theo chi tiết request → không chuyển tiếp.
      const reason = error?.name === 'TimeoutError' ? 'timed out' : 'unreachable';
      throw new AppError(502, `Storage ${action} failed: storage service ${reason}`);
    }

    if (!response.ok) {
      // Không đọc body lỗi: có thể chứa chi tiết nội bộ của provider. Giải phóng stream.
      try {
        await response.body?.cancel();
      } catch {
        // Không có gì để giải phóng.
      }
      throw new AppError(502, `Storage ${action} failed (${response.status})`);
    }

    return response;
  }

  function publicUrl(objectPath) {
    return `${baseUrl}/storage/v1/object/public/${bucketSegment}/${encodePath(objectPath)}`;
  }

  async function upload(buffer, { filename, folder = 'products', mimetype } = {}) {
    if (!FOLDER_PATTERN.test(folder)) {
      throw AppError.badRequest('Invalid storage folder');
    }

    const objectPath = `${folder}/${crypto.randomUUID()}.${pickExtension(filename, mimetype)}`;

    const response = await request('upload', `${baseUrl}/storage/v1/object/${bucketSegment}/${encodePath(objectPath)}`, {
      method: 'POST',
      headers: {
        'content-type': mimetype || 'application/octet-stream',
        'cache-control': CACHE_CONTROL,
        // Không ghi đè object có sẵn: trùng tên (gần như không thể với UUID) thì báo lỗi.
        'x-upsert': 'false',
      },
      body: buffer,
    });
    try {
      await response.body?.cancel();
    } catch {
      // Body upload thành công không cần dùng.
    }

    return { url: publicUrl(objectPath), public_id: objectPath };
  }

  async function destroy(publicId) {
    if (!publicId) return;
    // public_id do driver khác sinh ra (hoặc dữ liệu bịa) thì bỏ qua, không gọi API.
    if (!OBJECT_PATH_PATTERN.test(publicId) || publicId.split('/').includes('..')) return;

    const response = await request('delete', `${baseUrl}/storage/v1/object/${bucketSegment}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [publicId] }),
    });
    try {
      await response.body?.cancel();
    } catch {
      // Không cần kết quả xóa.
    }
  }

  return { upload, destroy, publicUrl, name: 'supabase' };
}

module.exports = { createSupabaseDriver, REQUEST_TIMEOUT_MS };
