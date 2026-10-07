'use strict';

const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { prisma } = require('../../config/database');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const { INVENTORY_TYPES, INCREASING_TYPES, SORTABLE } = require('./inventory.constant');
const repo = require('./inventory.repository');

/**
 * Primitive duy nhất được phép đổi `stock_quantity`.
 *
 * Luôn chạy BÊN TRONG một transaction do caller mở, nên thao tác kho và thao tác
 * nghiệp vụ kèm theo (tạo đơn, hủy đơn) cùng commit hoặc cùng rollback.
 * W5 (checkout / hủy đơn) sẽ gọi lại chính hàm này thay vì tự viết logic kho.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} input
 * @param {number} input.variant_id
 * @param {'IMPORT'|'EXPORT'|'SALE'|'RETURN'|'ADJUSTMENT'} input.type
 * @param {number} input.quantity số lượng tuyệt đối (> 0); dấu suy ra từ `type`
 * @param {number} [input.delta] chỉ dùng cho ADJUSTMENT: có thể âm hoặc dương
 */
async function applyStockMovement(tx, { variant_id, type, quantity, delta, reference, note, created_by }) {
  const variant = await repo.lockVariantForUpdate(tx, variant_id);
  if (!variant) throw AppError.notFound(`Variant ${variant_id} not found`);

  const signedQuantity =
    type === INVENTORY_TYPES.ADJUSTMENT
      ? delta
      : (INCREASING_TYPES.includes(type) ? 1 : -1) * quantity;

  const stockBefore = variant.stock_quantity;
  const stockAfter = stockBefore + signedQuantity;

  // Bất biến cốt lõi: tồn kho không bao giờ âm.
  if (stockAfter < 0) {
    throw AppError.unprocessable(
      `Insufficient stock for ${variant.sku}: available ${stockBefore}, requested ${Math.abs(signedQuantity)}`
    );
  }

  await repo.applyStock(tx, variant_id, stockAfter);

  const transaction = await repo.createTransaction(tx, {
    variant_id,
    type,
    quantity: signedQuantity,
    stock_before: stockBefore,
    stock_after: stockAfter,
    reference: reference ?? null,
    note: note ?? null,
    created_by: created_by ?? null,
  });

  return { transaction, variant, stock_before: stockBefore, stock_after: stockAfter };
}

/** DTO giao dịch kho theo contract §2.9. */
function toTransactionDTO(txn) {
  return {
    id: txn.id,
    type: txn.type,
    quantity: txn.quantity,
    stock_before: txn.stock_before,
    stock_after: txn.stock_after,
    reference: txn.reference,
    note: txn.note,
    created_at: txn.created_at,
    variant: txn.variant
      ? {
          id: txn.variant.id,
          sku: txn.variant.sku,
          volume_ml: txn.variant.volume_ml,
          product_id: txn.variant.product?.id,
          product_name: txn.variant.product?.name,
        }
      : null,
    created_by: txn.creator ? { id: txn.creator.id, full_name: txn.creator.full_name } : null,
  };
}

function toStockRowDTO(variant) {
  return {
    variant_id: variant.id,
    sku: variant.sku,
    volume_ml: variant.volume_ml,
    price: variant.price,
    stock_quantity: variant.stock_quantity,
    status: variant.status,
    product_id: variant.product.id,
    product_name: variant.product.name,
    brand_name: variant.product.brand?.name ?? null,
    category_name: variant.product.category?.name ?? null,
    is_low_stock: variant.stock_quantity <= env.LOW_STOCK_THRESHOLD,
    is_out_of_stock: variant.stock_quantity === 0,
  };
}

async function list(query) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
    defaultSort: { stock_quantity: 'asc' },
  });

  const { items, total } = await repo.findVariants({
    filters: {
      q: query.q,
      brand_id: query.brand_id,
      category_id: query.category_id,
      low_stock: query.low_stock,
      out_of_stock: query.out_of_stock,
      status: query.status,
    },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items.map(toStockRowDTO), total, { page, limit });
}

const summary = () => repo.summary();

const lowStock = (query) => list({ ...query, low_stock: true, sort: 'stock_quantity:asc' });

async function listTransactions(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const { items, total } = await repo.findTransactions({
    filters: {
      variant_id: query.variant_id,
      type: query.type,
      from: query.from,
      to: query.to,
      q: query.q,
    },
    skip,
    take,
  });

  return buildPaginatedResult(items.map(toTransactionDTO), total, { page, limit });
}

/** Chặn gửi 2 dòng cùng variant trong 1 phiếu — tránh nhầm lẫn khi đối chiếu. */
function assertUniqueVariants(items) {
  const ids = items.map((item) => item.variant_id);
  if (new Set(ids).size !== ids.length) {
    throw AppError.badRequest('Each variant may appear only once per request');
  }
}

/**
 * Nhập / xuất kho nhiều dòng trong MỘT transaction: một dòng fail thì cả phiếu
 * rollback, không để kho nhập được nửa phiếu.
 */
async function createBulkMovement({ type, items, note, userId }) {
  assertUniqueVariants(items);

  const transactionIds = await prisma.$transaction(async (tx) => {
    const ids = [];
    for (const item of items) {
      const { transaction } = await applyStockMovement(tx, {
        variant_id: item.variant_id,
        type,
        quantity: item.quantity,
        note: item.note ?? note,
        created_by: userId,
      });
      ids.push(transaction.id);
    }
    return ids;
  });

  // Đọc lại theo đúng id vừa tạo để trả DTO có quan hệ. Không lấy "N dòng mới
  // nhất" vì request đồng thời sẽ chen vào giữa.
  const detailed = await repo.findTransactionsByIds(transactionIds);
  return detailed.map(toTransactionDTO);
}

/**
 * Điều chỉnh kho về một con số cụ thể (kiểm kê). Ghi delta chứ không ghi số mới,
 * để lịch sử vẫn cộng dồn đúng bằng tồn kho hiện tại.
 */
async function createAdjustment({ variant_id, new_quantity, note, userId }) {
  if (new_quantity < 0) throw AppError.unprocessable('new_quantity must be >= 0');

  const result = await prisma.$transaction(async (tx) => {
    const current = await repo.lockVariantForUpdate(tx, variant_id);
    if (!current) throw AppError.notFound(`Variant ${variant_id} not found`);

    const delta = new_quantity - current.stock_quantity;
    if (delta === 0) {
      throw AppError.badRequest('new_quantity is the same as current stock, nothing to adjust');
    }

    return applyStockMovement(tx, {
      variant_id,
      type: INVENTORY_TYPES.ADJUSTMENT,
      delta,
      note,
      created_by: userId,
    });
  });

  const txn = await prisma.inventoryTransaction.findUnique({
    where: { id: result.transaction.id },
    include: {
      variant: {
        select: { id: true, sku: true, volume_ml: true, product: { select: { id: true, name: true } } },
      },
      creator: { select: { id: true, full_name: true } },
    },
  });

  return toTransactionDTO(txn);
}

module.exports = {
  applyStockMovement,
  toTransactionDTO,
  toStockRowDTO,
  list,
  summary,
  lowStock,
  listTransactions,
  createBulkMovement,
  createAdjustment,
};
