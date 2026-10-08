'use strict';

/**
 * Danh sách origin được phép gọi API, đọc từ env `CORS_ORIGIN`.
 *
 * - Nhiều origin cách nhau bằng dấu phẩy:
 *     CORS_ORIGIN=https://perfume-shop.vercel.app,http://localhost:5173
 * - Cho phép wildcard `*` trong NHÃN ĐẦU TIÊN của host để nhận preview deployment.
 *   Preview Vercel có dạng `<project>-<hash>-<team-slug>.vercel.app`, nên dùng pattern
 *   gắn với team (team slug là duy nhất trên Vercel → phần đuôi neo pattern vào team):
 *     CORS_ORIGIN=https://perfume-shop.vercel.app,https://perfume-shop-*-<team-slug>.vercel.app
 *   `*` chỉ khớp ký tự của MỘT nhãn DNS (chữ, số, `-`), không khớp `.`/`/`/`:` — nên
 *   `https://perfume-shop-x-<team>.vercel.app.evil.com` vẫn bị chặn.
 *
 * Pattern bị TỪ CHỐI ngay lúc parse (env.js gọi lúc boot → app fail-fast, không chạy
 * với CORS hở). API dùng credentials nên một pattern quá rộng = mọi người khớp được:
 * - `*` đứng một mình, `*` ở scheme/port, `*` ngoài nhãn đầu tiên, có path/query.
 * - Nhãn wildcard nằm ngay trên một hậu tố dùng chung (`vercel.app`, `netlify.app`,
 *   `pages.dev`, `github.io`, `onrender.com`) hoặc ngay trên TLD (`*.com`):
 *     • `https://*.vercel.app` — ai deploy project Vercel nào cũng khớp;
 *     • `https://perfume-shop-*.vercel.app` — ai đặt tên project `perfume-shop-x` cũng
 *       được domain `perfume-shop-x.vercel.app` → khớp. Trên hậu tố dùng chung, nhãn
 *       wildcard phải có phần cố định SAU `*` (vd `-<team-slug>`) để neo vào team.
 *   Wildcard dưới domain riêng của bạn vẫn hợp lệ: `https://*.shop.example.com`,
 *   `https://*.my-project.pages.dev`.
 */

/** Hậu tố mà nhiều chủ sở hữu khác nhau cùng được cấp subdomain (public suffix dùng chung). */
const SHARED_PUBLIC_SUFFIXES = ['vercel.app', 'netlify.app', 'pages.dev', 'github.io', 'onrender.com'];

/** Ký tự `*` được phép khớp: một nhãn DNS, không qua `.`. */
const WILDCARD_SOURCE = '[a-z0-9-]+';

/** Pattern đã compile — dựng một lần lúc parse, request chỉ việc `test`. */
const compiledPatterns = new Map();

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function invalidPattern(pattern, reason) {
  return new Error(`Invalid CORS_ORIGIN entry "${pattern}": ${reason}`);
}

/** Kiểm tra pattern wildcard có an toàn không; ném lỗi cấu hình nếu quá rộng. */
function validateWildcardPattern(pattern) {
  const match = /^(https?):\/\/([^/?#:]+)(:\d+)?$/i.exec(pattern);
  if (!match) {
    throw invalidPattern(
      pattern,
      'wildcard origin must look like https://<host>[:port] with `*` only inside the host'
    );
  }

  const labels = match[2].toLowerCase().split('.');
  const [first, ...rest] = labels;

  if (labels.some((label) => !/^[a-z0-9*-]+$/.test(label))) {
    throw invalidPattern(pattern, 'host labels may only contain letters, digits, "-" and "*"');
  }
  if (rest.some((label) => label.includes('*'))) {
    throw invalidPattern(pattern, '`*` is only allowed in the leftmost host label');
  }

  const parent = rest.join('.');
  const isSharedParent = rest.length <= 1 || SHARED_PUBLIC_SUFFIXES.includes(parent);
  if (!isSharedParent) return;

  if (first === '*') {
    throw invalidPattern(
      pattern,
      `"*.${parent || ''}" matches sites owned by anyone. ` +
        'Use a team-scoped pattern such as https://<project>-*-<team-slug>.vercel.app'
    );
  }
  if (first.endsWith('*')) {
    throw invalidPattern(
      pattern,
      `"${first}" under the shared suffix "${parent}" can be claimed by anyone naming a project ` +
        'with that prefix. Anchor the wildcard with a fixed suffix, e.g. ' +
        'https://<project>-*-<team-slug>.vercel.app'
    );
  }
}

/** Validate + compile một pattern wildcard (cache theo chuỗi pattern). */
function compilePattern(pattern) {
  const cached = compiledPatterns.get(pattern);
  if (cached) return cached;

  validateWildcardPattern(pattern);
  const source = pattern.split('*').map(escapeRegExp).join(WILDCARD_SOURCE);
  const regex = new RegExp(`^${source}$`, 'i');
  compiledPatterns.set(pattern, regex);
  return regex;
}

/**
 * "a, b/ ,," → ["a", "b"] — bỏ khoảng trắng, entry rỗng và dấu `/` cuối.
 * Pattern wildcard được validate + compile ngay tại đây: cấu hình sai → throw.
 */
function parseOrigins(raw) {
  const origins = String(raw || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  origins.filter((origin) => origin.includes('*')).forEach(compilePattern);
  return origins;
}

/** Origin (đúng format trình duyệt gửi, không có `/` cuối) có nằm trong danh sách không. */
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  return allowedOrigins.some((allowed) =>
    allowed.includes('*') ? compilePattern(allowed).test(origin) : allowed === origin
  );
}

module.exports = { parseOrigins, isOriginAllowed, SHARED_PUBLIC_SUFFIXES };
