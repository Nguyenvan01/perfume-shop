'use strict';

const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const { generateUniqueSlug } = require('../../utils/slugHelper');
const storage = require('../../utils/storage');
const repo = require('./brand.repository');

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
  const brand = await repo.findById(id, { publicOnly });
  if (!brand) throw AppError.notFound('Brand not found');
  return brand;
}

async function create(payload) {
  const slug = payload.slug
    ? await generateUniqueSlug(repo.findBySlug, payload.slug)
    : await generateUniqueSlug(repo.findBySlug, payload.name);

  return repo.create({ ...payload, slug });
}

async function update(id, payload) {
  await detail(id);

  const data = { ...payload };
  // Chỉ sinh lại slug khi người dùng chủ động đổi slug hoặc đổi tên.
  if (payload.slug) {
    data.slug = await generateUniqueSlug(repo.findBySlug, payload.slug, id);
  } else if (payload.name) {
    data.slug = await generateUniqueSlug(repo.findBySlug, payload.name, id);
  }

  return repo.update(id, data);
}

async function remove(id) {
  await detail(id);

  // Xóa brand khi còn sản phẩm sẽ làm sản phẩm mất thương hiệu → chặn.
  const productCount = await repo.countProducts(id);
  if (productCount > 0) {
    throw AppError.conflict(`Brand still has ${productCount} product(s)`);
  }

  const brand = await repo.findRawById(id);
  await repo.softDelete(id);

  // Soft delete record nhưng logo thì xóa thật, tránh rác ở storage.
  if (brand?.logo_public_id) {
    await storage.destroy(brand.logo_public_id).catch(() => {});
  }
}

/** Upload logo: xóa logo cũ sau khi upload mới thành công. */
async function uploadLogo(id, file) {
  const brand = await repo.findRawById(id);
  if (!brand) throw AppError.notFound('Brand not found');

  const uploaded = await storage.upload(file.buffer, {
    filename: file.originalname,
    mimetype: file.mimetype,
    folder: 'brands',
  });

  const updated = await repo.update(id, {
    logo_url: uploaded.url,
    logo_public_id: uploaded.public_id,
  });

  if (brand.logo_public_id) {
    await storage.destroy(brand.logo_public_id).catch(() => {});
  }

  return updated;
}

module.exports = { list, detail, create, update, remove, uploadLogo };
