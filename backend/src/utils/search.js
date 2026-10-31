'use strict';

/**
 * Bộ lọc tìm kiếm chuỗi cho ô `q`.
 * PostgreSQL so sánh chuỗi PHÂN BIỆT hoa/thường (khác MySQL collation *_ci), nên
 * mọi ô tìm kiếm phải dùng `mode: 'insensitive'` (ILIKE) để "dior" vẫn khớp "Dior".
 * @param {string} q
 */
const containsInsensitive = (q) => ({ contains: q, mode: 'insensitive' });

module.exports = { containsInsensitive };
