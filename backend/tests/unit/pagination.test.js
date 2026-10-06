'use strict';

const { parsePagination, buildPaginatedResult, MAX_LIMIT } = require('../../src/utils/pagination');

describe('parsePagination', () => {
  it('dùng default khi không truyền gì', () => {
    expect(parsePagination({})).toMatchObject({ page: 1, limit: 10, skip: 0 });
  });

  it('clamp limit theo MAX_LIMIT', () => {
    expect(parsePagination({ limit: '9999' }).limit).toBe(MAX_LIMIT);
  });

  it('bỏ qua giá trị không hợp lệ', () => {
    expect(parsePagination({ page: '-3', limit: 'abc' })).toMatchObject({ page: 1, limit: 10 });
  });

  it('chỉ nhận sort field trong whitelist', () => {
    const allowed = parsePagination({ sort: 'price:asc' }, { allowedSortFields: ['price'] });
    expect(allowed.orderBy).toEqual({ price: 'asc' });

    const rejected = parsePagination({ sort: 'password_hash:asc' }, { allowedSortFields: ['price'] });
    expect(rejected.orderBy).toEqual({ created_at: 'desc' });
  });
});

describe('buildPaginatedResult', () => {
  it('tính totalPages đúng', () => {
    const result = buildPaginatedResult([1, 2], 25, { page: 1, limit: 10 });
    expect(result.meta).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
  });
});
