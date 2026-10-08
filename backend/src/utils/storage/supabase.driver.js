'use strict';

const crypto = require('crypto');
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

/** Chỉ nhận đúng các loại ảnh mà upload.middleware cho phép. */
const EXTENSION_BY_MIMETYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const FOLDER_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i;
const OBJECT_PATH_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_.-]+)*$/i;
// Key legacy (anon/service_role) là JWT: 3 phần base64url ngăn bởi dấu chấm.
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Key mới `sb_secret_...` KHÔNG phải JWT: chỉ gửi qua header `apikey`; gửi kèm
 * `Authorization: Bearer` sẽ bị gateway parse như JWT và từ chối (401).
 * Key legacy service_role là JWT: gửi cả `apikey` lẫn Bearer như supabase-js.
 */
function buildAuthHeaders(key) {
  const headers = { apikey: key };
  if (!key.startsWith('sb_') && JWT_PATTERN.test(key)) {
    headers.authorization = `Bearer ${key}`;
  }
  return headers;
}

/** Encode từng segment, giữ dấu "/" làm phân cách. */
const encodePath = (objectPath) => objectPath.split('/').map(encodeURIComponent).join('/');

/** Giải phóng body không dùng tới để không giữ connection. */
async function discardBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Không có gì để giải phóng.
  }
}

/**
 * @param {object} config
 * @param {string} config.url              SUPABASE_URL (đã validate ở config/env.js)
 * @param {string} config.serviceRoleKey   SUPABASE_SERVICE_ROLE_KEY (server-only)
 * @param {string} config.bucket           SUPABASE_STORAGE_BUCKET (public bucket)
 * @param {typeof fetch} [config.fetchImpl] inject để test
 * @param {number} [config.timeoutMs]       timeout mỗi request
 */
function createSupabaseDriver({
  url,
  serviceRoleKey,
  bucket,
  fetchImpl,
  timeoutMs = REQUEST_TIMEOUT_MS,
} = {}) {
  if (!url || !serviceRoleKey || !bucket) {
    throw new Error(
      'Supabase storage driver requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET'
    );
  }

  const baseUrl = url.replace(/\/+$/, '');
  const bucketSegment = encodeURIComponent(bucket);
  const doFetch = fetchImpl || ((...args) => globalThis.fetch(...args));
  const authHeaders = buildAuthHeaders(serviceRoleKey);

  async function request(action, endpoint, init) {
    let response;
    try {
      response = await doFetch(endpoint, {
        ...init,
        headers: { ...init.headers, ...authHeaders },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      // Lỗi mạng/timeout của fetch có thể mang theo chi tiết request → không chuyển tiếp.
      const reason = error?.name === 'TimeoutError' ? 'timed out' : 'unreachable';
      throw new AppError(502, `Storage ${action} failed: storage service ${reason}`);
    }

    // Không đọc body (cả lỗi lẫn thành công): body lỗi có thể chứa chi tiết nội bộ.
    await discardBody(response);
    if (!response.ok) {
      throw new AppError(502, `Storage ${action} failed (${response.status})`);
    }
  }

  function publicUrl(objectPath) {
    return `${baseUrl}/storage/v1/object/public/${bucketSegment}/${encodePath(objectPath)}`;
  }

  async function upload(buffer, { folder = 'products', mimetype } = {}) {
    const extension = EXTENSION_BY_MIMETYPE[mimetype];
    if (!extension) {
      throw AppError.badRequest(
        `Unsupported image type. Allowed: ${Object.keys(EXTENSION_BY_MIMETYPE).join(', ')}`
      );
    }
    if (!FOLDER_PATTERN.test(folder)) {
      throw AppError.badRequest('Invalid storage folder');
    }

    const objectPath = `${folder}/${crypto.randomUUID()}.${extension}`;
    const endpoint = `${baseUrl}/storage/v1/object/${bucketSegment}/${encodePath(objectPath)}`;

    await request('upload', endpoint, {
      method: 'POST',
      headers: {
        'content-type': mimetype,
        'cache-control': CACHE_CONTROL,
        // Không ghi đè object có sẵn: trùng tên (gần như không thể với UUID) thì báo lỗi.
        'x-upsert': 'false',
      },
      body: buffer,
    });

    return { url: publicUrl(objectPath), public_id: objectPath };
  }

  async function destroy(publicId) {
    if (!publicId) return;
    // public_id do driver khác sinh ra (hoặc dữ liệu bịa) thì bỏ qua, không gọi API.
    if (!OBJECT_PATH_PATTERN.test(publicId) || publicId.split('/').includes('..')) return;

    await request('delete', `${baseUrl}/storage/v1/object/${bucketSegment}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prefixes: [publicId] }),
    });
  }

  return { upload, destroy, publicUrl, name: 'supabase' };
}

module.exports = { createSupabaseDriver, buildAuthHeaders, REQUEST_TIMEOUT_MS, CACHE_CONTROL };
