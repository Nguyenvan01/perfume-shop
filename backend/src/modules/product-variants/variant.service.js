'use strict';

const AppError = require('../../utils/AppError');
const repo = require('./variant.repository');

async function assertProductExists(product_id) {
  const product = await repo.findProduct(product_id);
  if (!product) throw AppError.notFound('Product not found');
  return product;
}

async function listByProduct(product_id) {
  await assertProductExists(product_id);
  return repo.findByProduct(product_id);
}

async function detail(id) {
  const variant = await repo.findById(id);
  if (!variant) throw AppError.notFound('Variant not found');
  return variant;
}

async function assertSkuFree(sku, currentId) {
  const existing = await repo.findBySku(sku);
  if (existing && existing.id !== currentId) throw AppError.conflict('SKU already exists');
}

async function assertVolumeFree(product_id, volume_ml, currentId) {
  const existing = await repo.findByProductAndVolume(product_id, volume_ml);
  if (existing && existing.id !== currentId) {
    throw AppError.conflict('This product already has a variant with the same volume');
  }
}

async function create(product_id, payload) {
  await assertProductExists(product_id);
  await assertSkuFree(payload.sku);
  await assertVolumeFree(product_id, payload.volume_ml);

  // stock_quantity luôn bắt đầu từ 0 — chỉ module inventory được thay đổi tồn kho.
  return repo.create({ ...payload, product_id });
}

async function update(id, payload) {
  const variant = await detail(id);

  if (payload.sku) await assertSkuFree(payload.sku, id);
  if (payload.volume_ml) await assertVolumeFree(variant.product_id, payload.volume_ml, id);

  // sale_price phải so với price mới (nếu có đổi), không phải price cũ.
  const nextPrice = payload.price ?? Number(variant.price);
  const nextSalePrice = payload.sale_price === undefined ? variant.sale_price : payload.sale_price;
  if (nextSalePrice != null && Number(nextSalePrice) > Number(nextPrice)) {
    throw AppError.badRequest('sale_price must not exceed price', [
      { field: 'sale_price', message: 'sale_price must not exceed price' },
    ]);
  }

  return repo.update(id, payload);
}

async function remove(id) {
  const variant = await detail(id);

  // Đã bán thì order_details tham chiếu tới variant → xóa sẽ làm hỏng đơn cũ.
  if ((await repo.countOrderUsage(id)) > 0) {
    throw AppError.conflict('Variant is used in orders and cannot be deleted');
  }
  if ((await repo.countInventoryTxns(id)) > 0) {
    throw AppError.conflict('Variant has inventory history and cannot be deleted');
  }
  if (variant.stock_quantity > 0) {
    throw AppError.conflict('Variant still has stock. Export stock before deleting');
  }

  await repo.remove(id);
}

module.exports = { listByProduct, detail, create, update, remove };
