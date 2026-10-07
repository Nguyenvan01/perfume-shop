'use strict';

const { prisma } = require('../../config/database');

const CART_ITEM_INCLUDE = {
  variant: {
    select: {
      id: true,
      sku: true,
      volume_ml: true,
      price: true,
      sale_price: true,
      stock_quantity: true,
      status: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          deleted_at: true,
          images: {
            where: { is_primary: true },
            take: 1,
            select: { image_url: true },
          },
        },
      },
    },
  },
};

const findCustomerByUserId = (user_id, client = prisma) =>
  client.customer.findUnique({ where: { user_id } });

const findCartWithItems = (customer_id, client = prisma) =>
  client.cart.findUnique({
    where: { customer_id },
    include: { items: { orderBy: { id: 'asc' }, include: CART_ITEM_INCLUDE } },
  });

/** Tự tạo giỏ nếu chưa có — khách đăng ký trước khi có cart (dữ liệu cũ) vẫn dùng được. */
const ensureCart = async (customer_id, client = prisma) => {
  await client.cart.upsert({
    where: { customer_id },
    update: {},
    create: { customer_id },
  });
  return findCartWithItems(customer_id, client);
};

const findVariantForCart = (id) =>
  prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      status: true,
      stock_quantity: true,
      product: { select: { id: true, name: true, status: true, deleted_at: true } },
    },
  });

const findItem = (id) => prisma.cartItem.findUnique({ where: { id } });

const findItemByVariant = (cart_id, variant_id) =>
  prisma.cartItem.findUnique({ where: { cart_id_variant_id: { cart_id, variant_id } } });

const createItem = (data) => prisma.cartItem.create({ data });

const updateItemQuantity = (id, quantity) =>
  prisma.cartItem.update({ where: { id }, data: { quantity } });

const deleteItem = (id) => prisma.cartItem.delete({ where: { id } });

const clearItems = (cart_id, client = prisma) =>
  client.cartItem.deleteMany({ where: { cart_id } });

module.exports = {
  findCustomerByUserId,
  findCartWithItems,
  ensureCart,
  findVariantForCart,
  findItem,
  findItemByVariant,
  createItem,
  updateItemQuantity,
  deleteItem,
  clearItems,
};
