'use strict';

const { parseOrigins, isOriginAllowed } = require('../../src/utils/corsOrigin');

describe('parseOrigins', () => {
  it('tách nhiều origin bằng dấu phẩy, bỏ khoảng trắng và entry rỗng', () => {
    expect(parseOrigins(' https://shop.vercel.app , http://localhost:5173,,')).toEqual([
      'https://shop.vercel.app',
      'http://localhost:5173',
    ]);
  });

  it('bỏ dấu / ở cuối để khớp đúng header Origin của trình duyệt', () => {
    expect(parseOrigins('https://shop.vercel.app/')).toEqual(['https://shop.vercel.app']);
  });

  it('input rỗng → danh sách rỗng', () => {
    expect(parseOrigins('')).toEqual([]);
    expect(parseOrigins(undefined)).toEqual([]);
  });
});

describe('isOriginAllowed', () => {
  const allowed = parseOrigins(
    'https://perfume-shop.vercel.app,http://localhost:5173,https://perfume-shop-*.vercel.app'
  );

  it('cho phép origin khớp chính xác (nhiều origin)', () => {
    expect(isOriginAllowed('https://perfume-shop.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', allowed)).toBe(true);
  });

  it('chặn origin không có trong danh sách hoặc khác scheme/port', () => {
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('http://perfume-shop.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(false);
  });

  it('wildcard khớp preview deployment của Vercel', () => {
    expect(isOriginAllowed('https://perfume-shop-git-main-team.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://perfume-shop-abc123.vercel.app', allowed)).toBe(true);
  });

  it('wildcard không khớp qua dấu chấm, path hay domain khác', () => {
    expect(isOriginAllowed('https://perfume-shop-x.vercel.app.evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('https://perfume-shop-a.b.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com/perfume-shop-x.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://perfume-shop-.vercel.app', allowed)).toBe(false);
  });

  it('`*` đứng một mình không mở cho mọi origin', () => {
    expect(isOriginAllowed('https://evil.com', ['*'])).toBe(false);
  });

  it('không có Origin → false (app.js tự cho qua request server-to-server)', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(false);
  });
});
