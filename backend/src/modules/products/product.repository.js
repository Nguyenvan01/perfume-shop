'use strict';

const { prisma } = require('../../config/database');
const { PRODUCT_INCLUDE } = require('./product.constant');

const notDeleted = { deleted_at: null };

function buildWhere(filters) {
  const {
    q,
    brand_id,
    category_id,
    gender,
    concentration,
    min_price,
    max_price,
    in_stock,
    status,
    publicOnly,
  } = filters;

  const where = { ...notDeleted };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { fragrance_family: { contains: q } },
      { brand: { name: { contains: q } } },
    ];
  }
  if (brand_id) where.brand_id = brand_id;
  if (category_id) where.category_id = category_id;
  if (gender) where.gender = gender;
  if (concentration) where.concentration = concentration;
  if (status) where.status = status;
  if (publicOnly) where.status = 'ACTIVE';

  // Filter giá và tồn kho nằm ở variant → dùng `some` để lọc theo product.
  const variantConditions = {};
  if (min_price !== undefined) variantConditions.price = { gte: min_price };
  if (max_price !== undefined) {
    variantConditions.price = { ...(variantConditions.price ?? {}), lte: max_price };
  }
  if (in_stock) variantConditions.stock_quantity = { gt: 0 };

  if (Object.keys(variantConditions).length > 0) {
    where.variants = { some: { status: 'ACTIVE', ...variantConditions } };
  }

  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take, orderBy, include: PRODUCT_INCLUDE }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

/** Nhận id số hoặc slug — contract §2.6 cho phép cả hai. */
function findByIdOrSlug(idOrSlug, { publicOnly } = {}) {
  const asNumber = Number(idOrSlug);
  const identifier = Number.isInteger(asNumber) && asNumber > 0 ? { id: asNumber } : { slug: String(idOrSlug) };

  return prisma.product.findFirst({
    where: { ...identifier, ...notDeleted, ...(publicOnly ? { status: 'ACTIVE' } : {}) },
    include: PRODUCT_INCLUDE,
  });
}

const findBySlug = (slug) =>
  prisma.product.findFirst({ where: { slug, ...notDeleted }, select: { id: true } });

const findSkuConflicts = (skus) =>
  prisma.productVariant.findMany({ where: { sku: { in: skus } }, select: { sku: true } });

const findBrandById = (id) => prisma.brand.findFirst({ where: { id, deleted_at: null } });

const findCategoryById = (id) => prisma.category.findFirst({ where: { id, deleted_at: null } });

/** Tạo product + variants ban đầu trong 1 transaction. Stock luôn bắt đầu từ 0. */
const create = ({ variants, ...data }) =>
  prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data });

    if (variants?.length) {
      await tx.productVariant.createMany({
        data: variants.map((variant) => ({ ...variant, product_id: product.id })),
      });
    }

    return tx.product.findUnique({ where: { id: product.id }, include: PRODUCT_INCLUDE });
  });

const update = (id, data) =>
  prisma.product.update({ where: { id }, data, include: PRODUCT_INCLUDE });

const softDelete = (id) =>
  prisma.product.update({ where: { id }, data: { deleted_at: new Date(), status: 'INACTIVE' } });

module.exports = {
  findMany,
  findByIdOrSlug,
  findBySlug,
  findSkuConflicts,
  findBrandById,
  findCategoryById,
  create,
  update,
  softDelete,
};
