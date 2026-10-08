'use strict';

/**
 * Danh sách origin được phép gọi API, đọc từ env `CORS_ORIGIN`.
 *
 * - Nhiều origin cách nhau bằng dấu phẩy:
 *     CORS_ORIGIN=https://perfume-shop.vercel.app,http://localhost:5173
 * - Cho phép wildcard `*` trong host để nhận preview deployment của Vercel:
 *     CORS_ORIGIN=https://perfume-shop-*.vercel.app
 *   `*` chỉ khớp MỘT nhãn DNS (chữ, số, `-`), không khớp `.`/`/`/`:` — nên
 *   `https://perfume-shop-x.vercel.app.evil.com` vẫn bị chặn.
 *   `*` đứng một mình KHÔNG có nghĩa "mọi origin" (API dùng credentials).
 */

/** "a, b/ ,," → ["a", "b"] — bỏ khoảng trắng, entry rỗng và dấu `/` cuối. */
function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegExp(pattern) {
  const source = pattern.split('*').map(escapeRegExp).join('[a-z0-9-]+');
  return new RegExp(`^${source}$`, 'i');
}

/** Origin (đúng format trình duyệt gửi, không có `/` cuối) có nằm trong danh sách không. */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.some((allowed) =>
    allowed.includes('*') ? patternToRegExp(allowed).test(origin) : allowed === origin
  );
}

module.exports = { parseOrigins, isOriginAllowed };
