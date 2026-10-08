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

describe('parseOrigins — pattern wildcard bị từ chối lúc parse (fail-fast khi boot)', () => {
  it.each([
    ['https://*.vercel.app'],
    ['https://*.netlify.app'],
    ['https://*.pages.dev'],
    ['https://*.github.io'],
    ['https://*.onrender.com'],
    ['https://*.com'],
    ['https://*'],
    ['*'],
  ])('%s: wildcard là cả nhãn trên hậu tố dùng chung / TLD → throw', (pattern) => {
    expect(() => parseOrigins(pattern)).toThrow(/Invalid CORS_ORIGIN entry/);
  });

  it('prefix-only trên hậu tố dùng chung bị từ chối: ai đặt tên project `perfume-shop-x` cũng khớp', () => {
    expect(() => parseOrigins('https://perfume-shop-*.vercel.app')).toThrow(/Anchor the wildcard/);
    expect(() => parseOrigins('https://shop-*.netlify.app')).toThrow(/Anchor the wildcard/);
  });

  it('một entry sai làm hỏng cả danh sách (không âm thầm bỏ qua)', () => {
    expect(() => parseOrigins('https://perfume-shop.vercel.app,https://*.vercel.app')).toThrow(
      /\*\.vercel\.app/
    );
  });

  it('`*` ngoài host hoặc ngoài nhãn đầu tiên, hoặc có path → throw', () => {
    expect(() => parseOrigins('*://shop.example.com')).toThrow();
    expect(() => parseOrigins('http://localhost:*')).toThrow();
    expect(() => parseOrigins('https://shop.*.example.com')).toThrow(/leftmost/);
    expect(() => parseOrigins('https://*.example.com/path')).toThrow();
  });

  it('chấp nhận pattern gắn team Vercel và wildcard dưới domain riêng', () => {
    expect(parseOrigins('https://perfume-shop-*-acme-team.vercel.app')).toEqual([
      'https://perfume-shop-*-acme-team.vercel.app',
    ]);
    expect(() => parseOrigins('https://*.shop.example.com')).not.toThrow();
    expect(() => parseOrigins('https://*.my-project.pages.dev')).not.toThrow();
    expect(() => parseOrigins('http://localhost:5173')).not.toThrow();
  });
});

describe('isOriginAllowed', () => {
  const allowed = parseOrigins(
    'https://perfume-shop.vercel.app,http://localhost:5173,https://perfume-shop-*-acme-team.vercel.app'
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

  it('wildcard gắn team khớp preview deployment của Vercel (hash và git-branch URL)', () => {
    expect(isOriginAllowed('https://perfume-shop-abc123xyz-acme-team.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://perfume-shop-git-main-acme-team.vercel.app', allowed)).toBe(true);
  });

  it('wildcard gắn team: project khác cùng team hoặc team khác đều không khớp', () => {
    // Project khác trong CÙNG team: không có prefix `perfume-shop-` → chặn.
    expect(isOriginAllowed('https://evil-x-acme-team.vercel.app', allowed)).toBe(false);
    // Project tên `perfume-shop-x` ở team khác: đuôi là slug team kia → chặn.
    expect(isOriginAllowed('https://perfume-shop-x-abc123-evil.vercel.app', allowed)).toBe(false);
  });

  it('wildcard không khớp qua dấu chấm, path, domain khác, scheme hay port khác', () => {
    expect(isOriginAllowed('https://perfume-shop-x-acme-team.vercel.app.evil.com', allowed)).toBe(
      false
    );
    expect(isOriginAllowed('https://perfume-shop-a.b-acme-team.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com/perfume-shop-x-acme-team.vercel.app', allowed)).toBe(
      false
    );
    expect(isOriginAllowed('https://perfume-shop--acme-team.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('http://perfume-shop-x-acme-team.vercel.app', allowed)).toBe(false);
    expect(isOriginAllowed('https://perfume-shop-x-acme-team.vercel.app:8443', allowed)).toBe(false);
  });

  it('pattern có port chỉ khớp đúng port đó', () => {
    const local = parseOrigins('http://*.localtest.me:5173');
    expect(isOriginAllowed('http://shop.localtest.me:5173', local)).toBe(true);
    expect(isOriginAllowed('http://shop.localtest.me:5174', local)).toBe(false);
    expect(isOriginAllowed('https://shop.localtest.me:5173', local)).toBe(false);
  });

  it('pattern chưa qua parseOrigins vẫn bị validate (không mở `*` cho mọi origin)', () => {
    expect(() => isOriginAllowed('https://evil.com', ['*'])).toThrow(/Invalid CORS_ORIGIN entry/);
  });

  it('không có Origin → false (app.js tự cho qua request server-to-server)', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(false);
  });
});
