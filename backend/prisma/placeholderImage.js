'use strict';

/**
 * Sinh ảnh placeholder SVG cho dữ liệu seed (quyết định W3: không dùng ảnh có
 * bản quyền của site khác). SVG vì: không cần thư viện xử lý ảnh, mỗi file ~1-2KB,
 * nét ở mọi kích thước.
 *
 * Lưu ý: upload từ admin KHÔNG nhận SVG (xem upload.middleware.js) vì SVG do
 * người dùng gửi lên có thể chứa script. Ảnh ở đây do chính seed tạo ra.
 */

const fs = require('fs/promises');
const path = require('path');
const env = require('../src/config/env');

const UPLOAD_ROOT = path.resolve(__dirname, '..', env.UPLOAD_DIR);
const SEED_FOLDER = 'seed';

/** Màu theo brand để ảnh của cùng thương hiệu nhìn thành một bộ. */
const BRAND_PALETTE = {
  Dior: ['#1a1a2e', '#4a3b6b'],
  Chanel: ['#0f0f0f', '#3d3d3d'],
  Versace: ['#2b1d0e', '#6b5424'],
};

const DEFAULT_PALETTE = ['#2d2d3a', '#55556b'];

/** Escape ký tự đặc biệt để tên sản phẩm không phá cấu trúc XML. */
const escapeXml = (value) =>
  String(value).replace(
    /[<>&'"]/g,
    (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char]
  );

/** Cắt chữ dài để không tràn khung ảnh. */
function wrapText(text, maxCharsPerLine = 22, maxLines = 2) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, maxCharsPerLine - 1)}…`;
  }
  return lines;
}

function buildSvg({ brandName, productName, volumeMl, sku }) {
  const [from, to] = BRAND_PALETTE[brandName] ?? DEFAULT_PALETTE;
  const nameLines = wrapText(productName);
  const gradientId = `g${Buffer.from(sku).toString('hex').slice(0, 8)}`;

  const nameTspans = nameLines
    .map(
      (line, index) =>
        `<tspan x="400" dy="${index === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="${escapeXml(productName)}">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#${gradientId})"/>

  <!-- Hình chai nước hoa tối giản -->
  <g opacity="0.22" fill="#ffffff">
    <rect x="368" y="182" width="64" height="46" rx="8"/>
    <rect x="352" y="224" width="96" height="26" rx="6"/>
    <path d="M320 250 h160 a44 44 0 0 1 44 44 v234 a44 44 0 0 1 -44 44 h-160 a44 44 0 0 1 -44 -44 v-234 a44 44 0 0 1 44 -44 z"/>
  </g>

  <text x="400" y="128" text-anchor="middle" font-family="Georgia, serif" font-size="34" letter-spacing="10" fill="#ffffff" opacity="0.92">${escapeXml(brandName.toUpperCase())}</text>

  <text x="400" y="626" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="38" font-weight="600" fill="#ffffff">${nameTspans}</text>

  <text x="400" y="712" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff" opacity="0.95">${volumeMl} ml</text>

  <text x="400" y="762" text-anchor="middle" font-family="monospace" font-size="20" fill="#ffffff" opacity="0.6">${escapeXml(sku)}</text>
</svg>
`;
}

/**
 * Ghi ảnh placeholder xuống thư mục upload, trả về shape giống storage driver
 * để seed dùng được như một ảnh đã upload.
 */
async function writePlaceholderImage({ brandName, productName, volumeMl, sku }) {
  const dir = path.join(UPLOAD_ROOT, SEED_FOLDER);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${sku.toLowerCase()}.svg`;
  await fs.writeFile(path.join(dir, filename), buildSvg({ brandName, productName, volumeMl, sku }));

  const publicId = `${SEED_FOLDER}/${filename}`;
  return { url: `/uploads/${publicId}`, public_id: publicId };
}

module.exports = { writePlaceholderImage, buildSvg, wrapText, SEED_FOLDER };
