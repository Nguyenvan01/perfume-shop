'use strict';

const { slugify } = require('../../src/utils/slug');

describe('slugify', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(slugify('Nước hoa nam')).toBe('nuoc-hoa-nam');
    expect(slugify('Đồ Án Nước Hoa')).toBe('do-an-nuoc-hoa');
  });

  it('bỏ ký tự đặc biệt và gộp khoảng trắng', () => {
    expect(slugify('Dior Sauvage — Eau de Parfum!')).toBe('dior-sauvage-eau-de-parfum');
    expect(slugify('  Chanel   N°5  ')).toBe('chanel-n5');
  });

  it('trả rỗng với input rỗng', () => {
    expect(slugify('')).toBe('');
    expect(slugify(null)).toBe('');
  });
});
