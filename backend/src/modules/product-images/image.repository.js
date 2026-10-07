'use strict';

const { prisma } = require('../../config/database');

const IMAGE_SELECT = {
  id: true,
  product_id: true,
  image_url: true,
  is_primary: true,
  sort_order: true,
  created_at: true,
};

const findProduct = (id) => prisma.product.findFirst({ where: { id, deleted_at: null } });

const findByProduct = (product_id) =>
  prisma.productImage.findMany({
    where: { product_id },
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }, { id: 'asc' }],
    select: IMAGE_SELECT,
  });

const findById = (id) => prisma.productImage.findUnique({ where: { id } });

const countByProduct = (product_id) => prisma.productImage.count({ where: { product_id } });

const createMany = (rows) => prisma.productImage.createMany({ data: rows });

/** Đặt ảnh chính: bỏ cờ của mọi ảnh khác cùng product trong 1 transaction. */
const setPrimary = (product_id, imageId) =>
  prisma.$transaction([
    prisma.productImage.updateMany({ where: { product_id }, data: { is_primary: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { is_primary: true } }),
  ]);

const remove = (id) => prisma.productImage.delete({ where: { id } });

const promoteFirstAsPrimary = (product_id) =>
  prisma.$transaction(async (tx) => {
    const remaining = await tx.productImage.findFirst({
      where: { product_id },
      orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
    });
    if (remaining) {
      await tx.productImage.update({ where: { id: remaining.id }, data: { is_primary: true } });
    }
  });

module.exports = {
  IMAGE_SELECT,
  findProduct,
  findByProduct,
  findById,
  countByProduct,
  createMany,
  setPrimary,
  remove,
  promoteFirstAsPrimary,
};
