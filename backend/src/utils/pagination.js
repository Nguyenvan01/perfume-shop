'use strict';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Chuẩn hoá query phân trang + sort.
 * @param {object} query req.query
 * @param {object} options
 * @param {string[]} options.allowedSortFields whitelist chống sort theo field bất kỳ
 * @param {object} options.defaultSort vd { created_at: 'desc' }
 */
function parsePagination(query = {}, options = {}) {
  const { allowedSortFields = [], defaultSort = { created_at: 'desc' } } = options;

  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isNaN(rawPage) || rawPage < 1 ? DEFAULT_PAGE : rawPage;
  const limit = Number.isNaN(rawLimit) || rawLimit < 1 ? DEFAULT_LIMIT : Math.min(rawLimit, MAX_LIMIT);

  let orderBy = defaultSort;
  if (typeof query.sort === 'string' && query.sort.includes(':')) {
    const [field, rawDirection] = query.sort.split(':');
    const direction = rawDirection === 'asc' ? 'asc' : 'desc';
    if (allowedSortFields.includes(field)) {
      orderBy = { [field]: direction };
    }
  }

  return { page, limit, skip: (page - 1) * limit, take: limit, orderBy };
}

/** Gói kết quả list về đúng shape { items, meta }. */
function buildPaginatedResult(items, total, { page, limit }) {
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}

module.exports = { parsePagination, buildPaginatedResult, DEFAULT_LIMIT, MAX_LIMIT };
