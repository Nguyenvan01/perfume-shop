'use strict';

const { prisma } = require('../../config/database');

const VARIANT_SELECT = {
  id: true,
  product_id: true,
  sku: true,
  volume_ml: true,
  price: true,
  sale_price: true,
  stock_quantity: true,
  status: true,
  created_at: true,
  updated_at: true,
};

const findByProduct = (product_id) =>
  prisma.productVariant.findMany({
    where: { product_id },
    orderBy: { volume_ml: 'asc' },
    select: VARIANT_SELECT,
  });

const findById = (id) => prisma.productVariant.findUnique({ where: { id }, select: VARIANT_SELECT });

const findBySku = (sku) =>
  prisma.productVariant.findUnique({ where: { sku }, select: { id: true } });

const findByProductAndVolume = (product_id, volume_ml) =>
  prisma.productVariant.findUnique({
    where: { product_id_volume_ml: { product_id, volume_ml } },
    select: { id: true },
  });

const findProduct = (id) => prisma.product.findFirst({ where: { id, deleted_at: null } });

const countOrderUsage = (variant_id) => prisma.orderDetail.count({ where: { variant_id } });

const countInventoryTxns = (variant_id) =>
  prisma.inventoryTransaction.count({ where: { variant_id } });

const create = (data) => prisma.productVariant.create({ data, select: VARIANT_SELECT });

const update = (id, data) =>
  prisma.productVariant.update({ where: { id }, data, select: VARIANT_SELECT });

const remove = (id) => prisma.productVariant.delete({ where: { id } });

module.exports = {
  VARIANT_SELECT,
  findByProduct,
  findById,
  findBySku,
  findByProductAndVolume,
  findProduct,
  countOrderUsage,
  countInventoryTxns,
  create,
  update,
  remove,
};
