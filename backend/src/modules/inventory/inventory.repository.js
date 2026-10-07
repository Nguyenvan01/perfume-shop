'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const env = require('../../config/env');

/**
 * Đọc tồn kho hiện tại VÀ khóa dòng đó tới hết transaction (SELECT ... FOR UPDATE).
 * Đây là điểm chống race: hai checkout cùng lúc trên một variant sẽ xếp hàng,
 * không cùng đọc một giá trị stock rồi cùng trừ.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function lockVariantForUpdate(tx, variantId) {
  const rows = await tx.$queryRaw`
    SELECT id, sku, stock_quantity, status
    FROM product_variants
    WHERE id = ${variantId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

const applyStock = (tx, variantId, newQuantity) =>
  tx.productVariant.update({ where: { id: variantId }, data: { stock_quantity: newQuantity } });

const createTransaction = (tx, data) => tx.inventoryTransaction.create({ data });

// ─── Danh sách tồn kho ───

const TXN_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      volume_ml: true,
      product: { select: { id: true, name: true } },
    },
  },
  creator: { select: { id: true, full_name: true } },
};

function buildVariantWhere({ q, brand_id, category_id, low_stock, out_of_stock, status }) {
  const where = { product: { deleted_at: null } };

  if (q) {
    where.OR = [{ sku: { contains: q } }, { product: { name: { contains: q } } }];
  }
  if (brand_id) where.product = { ...where.product, brand_id };
  if (category_id) where.product = { ...where.product, category_id };
  if (status) where.status = status;
  if (out_of_stock) where.stock_quantity = 0;
  else if (low_stock) where.stock_quantity = { lte: env.LOW_STOCK_THRESHOLD };

  return where;
}

async function findVariants({ filters, skip, take, orderBy }) {
  const where = buildVariantWhere(filters);

  const [items, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      skip,
      take,
      orderBy,
      select: {
        id: true,
        sku: true,
        volume_ml: true,
        price: true,
        stock_quantity: true,
        status: true,
        product: {
          select: {
            id: true,
            name: true,
            brand: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  return { items, total };
}

/** Tổng quan kho — dùng aggregate, không kéo hết variant về JS rồi cộng. */
async function summary() {
  const activeProducts = { product: { deleted_at: null } };

  const [aggregate, lowStockCount, outOfStockCount, stockValueRows] = await Promise.all([
    prisma.productVariant.aggregate({
      where: activeProducts,
      _count: { id: true },
      _sum: { stock_quantity: true },
    }),
    prisma.productVariant.count({
      where: { ...activeProducts, stock_quantity: { lte: env.LOW_STOCK_THRESHOLD, gt: 0 } },
    }),
    prisma.productVariant.count({ where: { ...activeProducts, stock_quantity: 0 } }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(v.stock_quantity * v.price), 0) AS stock_value
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE p.deleted_at IS NULL
    `,
  ]);

  return {
    total_variants: aggregate._count.id,
    total_stock: aggregate._sum.stock_quantity ?? 0,
    low_stock_count: lowStockCount,
    out_of_stock_count: outOfStockCount,
    stock_value: new Prisma.Decimal(stockValueRows[0]?.stock_value ?? 0),
    low_stock_threshold: env.LOW_STOCK_THRESHOLD,
  };
}

// ─── Lịch sử giao dịch ───

function buildTxnWhere({ variant_id, type, from, to, q }) {
  const where = {};
  if (variant_id) where.variant_id = variant_id;
  if (type) where.type = type;
  if (q) {
    where.variant = { OR: [{ sku: { contains: q } }, { product: { name: { contains: q } } }] };
  }
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = from;
    if (to) where.created_at.lte = to;
  }
  return where;
}

async function findTransactions({ filters, skip, take }) {
  const where = buildTxnWhere(filters);

  const [items, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      include: TXN_INCLUDE,
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  return { items, total };
}

/** Đọc giao dịch theo đúng id vừa tạo — không dựa vào "N dòng mới nhất". */
const findTransactionsByIds = (ids) =>
  prisma.inventoryTransaction.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
    include: TXN_INCLUDE,
  });

const findVariantById = (id) =>
  prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      volume_ml: true,
      stock_quantity: true,
      status: true,
      product: { select: { id: true, name: true } },
    },
  });

module.exports = {
  lockVariantForUpdate,
  applyStock,
  createTransaction,
  findVariants,
  findVariantById,
  summary,
  findTransactions,
  findTransactionsByIds,
};
