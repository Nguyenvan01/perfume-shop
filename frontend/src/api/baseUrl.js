/**
 * Nơi DUY NHẤT đọc `VITE_API_BASE_URL`. Mọi module khác (axios client, ghép URL ảnh)
 * import từ đây để không lệch fallback giữa các file.
 */

export const DEV_FALLBACK_API_BASE_URL = 'http://localhost:4000/api/v1';

export const MISSING_API_BASE_URL_MESSAGE =
  'Ứng dụng chưa được cấu hình VITE_API_BASE_URL nên không gọi được API. ' +
  'Đặt biến này trong Vercel (Project Settings → Environment Variables) rồi build lại.';

/**
 * - Có biến → dùng (bỏ `/` cuối).
 * - Dev/test không có biến → localhost.
 * - Production build không có biến → `null` + console.error: KHÔNG âm thầm gọi
 *   localhost (máy người dùng), để lỗi cấu hình lộ ra ngay.
 */
export function resolveApiBaseUrl(env) {
  const configured = env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  if (env.PROD) {
    console.error(`[config] ${MISSING_API_BASE_URL_MESSAGE}`);
    return null;
  }
  return DEV_FALLBACK_API_BASE_URL;
}

/** `null` khi production build thiếu cấu hình — client.js sẽ reject mọi request. */
export const API_BASE_URL = resolveApiBaseUrl(import.meta.env);

/** Gốc server (bỏ /api/v1) để ghép đường dẫn ảnh tương đối do backend trả về. */
export const SERVER_ORIGIN = API_BASE_URL ? API_BASE_URL.replace(/\/api\/v1$/, '') : '';
