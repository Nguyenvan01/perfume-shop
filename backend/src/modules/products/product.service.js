'use strict';

const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const { generateUniqueSlug } = require('../../utils/slugHelper');
const { SORTABLE } = require('./product.constant');
const repo = require('./product.repository');

/** Giá hiệu lực của variant: có sale_price thì dùng sale_price. */
const effectivePrice = (variant) => Number(variant.sale_price ?? variant.price);

/**
 * Dựng ProductDTO theo contract §2: product không có giá/stock riêng,
 * `price_range` và `total_stock` được tính từ variants.
 */
function toProductDTO(product, { publicOnly = false } = {}) {
  if (!product) return null;

  // deleted_at là cờ nội bộ của soft delete — không đưa ra API.
  const { variants, images, brand, category, deleted_at: _deleted_at, ...rest } = product;

  // Khách không nên thấy variant đã ngừng bán.
  const visibleVariants = publicOnly ? variants.filter((v) => v.status === 'ACTIVE') : variants;
  const prices = visibleVariants.map(effectivePrice);

  return {
    ...rest,
    brand,
    category,
    variants: visibleVariants,
    images,
    price_range:
      prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
    total_stock: visibleVariants.reduce((sum, v) => sum + v.stock_quantity, 0),
    variant_count: visibleVariants.length,
  };
}

/** Sort theo giá phải làm sau khi tính price_range (giá nằm ở bảng variant). */
function sortByPrice(items, direction) {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const left = a.price_range?.min ?? Number.POSITIVE_INFINITY;
    const right = b.price_range?.min ?? Number.POSITIVE_INFINITY;
    return (left - right) * factor;
  });
}

async function list(query, { publicOnly = false } = {}) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
  });

  const { items, total } = await repo.findMany({
    filters: {
      q: query.q,
      brand_id: query.brand_id,
      category_id: query.category_id,
      gender: query.gender,
      concentration: query.concentration,
      min_price: query.min_price,
      max_price: query.max_price,
      in_stock: query.in_stock,
      status: query.status,
      publicOnly,
    },
    skip,
    take,
    orderBy,
  });

  let dtos = items.map((item) => toProductDTO(item, { publicOnly }));

  // `sort=price:asc|desc` chỉ sắp xếp trong trang hiện tại — đủ cho nhu cầu hiển thị
  // và tránh raw SQL phức tạp. Ghi rõ giới hạn này trong contract.
  if (typeof query.sort === 'string' && query.sort.startsWith('price:')) {
    dtos = sortByPrice(dtos, query.sort.split(':')[1]);
  }

  return buildPaginatedResult(dtos, total, { page, limit });
}

async function detail(idOrSlug, { publicOnly = false } = {}) {
  const product = await repo.findByIdOrSlug(idOrSlug, { publicOnly });
  if (!product) throw AppError.notFound('Product not found');
  return toProductDTO(product, { publicOnly });
}

async function assertRelations({ brand_id, category_id }) {
  if (brand_id !== undefined && !(await repo.findBrandById(brand_id))) {
    throw AppError.notFound('Brand not found');
  }
  if (category_id !== undefined && !(await repo.findCategoryById(category_id))) {
    throw AppError.notFound('Category not found');
  }
}

async function assertSkusAvailable(variants) {
  if (!variants?.length) return;

  const skus = variants.map((variant) => variant.sku);
  const duplicatesInPayload = skus.filter((sku, index) => skus.indexOf(sku) !== index);
  if (duplicatesInPayload.length > 0) {
    throw AppError.conflict(`Duplicated SKU in payload: ${[...new Set(duplicatesInPayload)].join(', ')}`);
  }

  const volumes = variants.map((variant) => variant.volume_ml);
  if (new Set(volumes).size !== volumes.length) {
    throw AppError.conflict('Duplicated volume_ml in payload');
  }

  const conflicts = await repo.findSkuConflicts(skus);
  if (conflicts.length > 0) {
    throw AppError.conflict(`SKU already exists: ${conflicts.map((c) => c.sku).join(', ')}`);
  }
}

async function create({ variants, slug, ...payload }) {
  await assertRelations(payload);
  await assertSkusAvailable(variants);

  const uniqueSlug = await generateUniqueSlug(repo.findBySlug, slug || payload.name);
  const product = await repo.create({ ...payload, slug: uniqueSlug, variants });
  return toProductDTO(product);
}

async function update(id, { slug, ...payload }) {
  await detail(id);
  await assertRelations(payload);

  const data = { ...payload };
  if (slug || payload.name) {
    data.slug = await generateUniqueSlug(repo.findBySlug, slug || payload.name, id);
  }

  return toProductDTO(await repo.update(id, data));
}

async function remove(id) {
  await detail(id);
  await repo.softDelete(id);
}

module.exports = { toProductDTO, list, detail, create, update, remove };
