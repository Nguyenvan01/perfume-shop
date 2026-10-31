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

/**
 * Khóa dòng giỏ của khách tới hết transaction (SELECT ... FOR UPDATE).
 * Checkout và mọi thao tác sửa giỏ đều lấy khóa này TRƯỚC khi đọc dòng hàng, nên hai
 * checkout đồng thời của cùng một giỏ xếp hàng: request sau thấy giỏ đã bị xóa.
 * Thứ tự khóa toàn hệ thống: cart → promotion → variants (id tăng dần).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function lockCartForUpdate(tx, customerId) {
  const rows = await tx.$queryRaw`
    SELECT id, customer_id
    FROM carts
    WHERE customer_id = ${customerId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

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

const findVariantForCart = (id, client = prisma) =>
  client.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      sku: true,
      status: true,
      stock_quantity: true,
      product: { select: { id: true, name: true, status: true, deleted_at: true } },
    },
  });

const findItem = (id, client = prisma) => client.cartItem.findUnique({ where: { id } });

const findItemByVariant = (cart_id, variant_id, client = prisma) =>
  client.cartItem.findUnique({ where: { cart_id_variant_id: { cart_id, variant_id } } });

const createItem = (data, client = prisma) => client.cartItem.create({ data });

const updateItemQuantity = (id, quantity, client = prisma) =>
  client.cartItem.update({ where: { id }, data: { quantity } });

const deleteItem = (id, client = prisma) => client.cartItem.delete({ where: { id } });

const clearItems = (cart_id, client = prisma) =>
  client.cartItem.deleteMany({ where: { cart_id } });

module.exports = {
  findCustomerByUserId,
  lockCartForUpdate,
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
