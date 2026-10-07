'use strict';

const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const { generateUniqueSlug } = require('../../utils/slugHelper');
const repo = require('./category.repository');

const SORTABLE = ['created_at', 'name', 'status'];

async function list(query, { publicOnly = false } = {}) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
    defaultSort: { name: 'asc' },
  });

  const { items, total } = await repo.findMany({
    filters: { q: query.q, status: query.status, publicOnly },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items, total, { page, limit });
}

async function detail(id, { publicOnly = false } = {}) {
  const category = await repo.findById(id, { publicOnly });
  if (!category) throw AppError.notFound('Category not found');
  return category;
}

async function create(payload) {
  const slug = await generateUniqueSlug(repo.findBySlug, payload.slug || payload.name);
  return repo.create({ ...payload, slug });
}

async function update(id, payload) {
  await detail(id);

  const data = { ...payload };
  if (payload.slug || payload.name) {
    data.slug = await generateUniqueSlug(repo.findBySlug, payload.slug || payload.name, id);
  }

  return repo.update(id, data);
}

async function remove(id) {
  await detail(id);

  const productCount = await repo.countProducts(id);
  if (productCount > 0) {
    throw AppError.conflict(`Category still has ${productCount} product(s)`);
  }

  await repo.softDelete(id);
}

module.exports = { list, detail, create, update, remove };
