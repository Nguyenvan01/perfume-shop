'use strict';

const { slugify } = require('./slug');

/**
 * Sinh slug duy nhất. Dùng chung cho brand / category / product để không lặp logic.
 * @param {(slug: string) => Promise<{id: number}|null>} findBySlug
 * @param {string} source tên để slugify
 * @param {number} [currentId] khi update: bỏ qua chính record đang sửa
 */
async function generateUniqueSlug(findBySlug, source, currentId) {
  const base = slugify(source) || 'item';
  let candidate = base;

  for (let suffix = 2; ; suffix += 1) {
    const existing = await findBySlug(candidate);
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${suffix}`;
  }
}

module.exports = { generateUniqueSlug };
