'use strict';

const VIETNAMESE_MAP = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ',
};

function removeVietnameseTones(input) {
  let output = input.toLowerCase();
  for (const [plain, accented] of Object.entries(VIETNAMESE_MAP)) {
    output = output.replace(new RegExp(`[${accented}]`, 'g'), plain);
  }
  return output;
}

/** "Nước hoa Nam" → "nuoc-hoa-nam" */
function slugify(input) {
  if (!input) return '';
  return removeVietnameseTones(String(input))
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

module.exports = { slugify, removeVietnameseTones };
