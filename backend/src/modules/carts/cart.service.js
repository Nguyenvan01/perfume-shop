'use strict';

const { Prisma } = require('@prisma/client');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { prisma } = require('../../config/database');
const promotionService = require('../promotions/promotion.service');
const repo = require('./cart.repository');

const toDecimal = (value) => new Prisma.Decimal(value ?? 0);

/** Giá đang bán của một variant: có sale_price thì dùng sale_price. */
const effectivePrice = (variant) => toDecimal(variant.sale_price ?? variant.price);

async function getCustomerOrFail(userId) {
  const customer = await repo.findCustomerByUserId(userId);
  if (!customer) throw AppError.forbidden('Only customer accounts have a cart');
  return customer;
}

/** Một dòng giỏ có còn mua được không: variant active, product active, còn hàng. */
function itemIssues(item) {
  const issues = [];
  const variant = item.variant;
  const product = variant.product;

  if (product.deleted_at || product.status !== 'ACTIVE' || variant.status !== 'ACTIVE') {
    issues.push('Sản phẩm không còn được bán');
  } else if (variant.stock_quantity === 0) {
    issues.push('Sản phẩm đã hết hàng');
  } else if (item.quantity > variant.stock_quantity) {
    issues.push(`Chỉ còn ${variant.stock_quantity} sản phẩm, giỏ hàng đang có ${item.quantity}`);
  }

  return issues;
}

function toCartItemDTO(item) {
  const variant = item.variant;
  const unitPrice = effectivePrice(variant);

  return {
    id: item.id,
    variant_id: variant.id,
    sku: variant.sku,
    volume_ml: variant.volume_ml,
    product_id: variant.product.id,
    product_name: variant.product.name,
    product_slug: variant.product.slug,
    image_url: variant.product.images?.[0]?.image_url ?? null,
    list_price: variant.price,
    unit_price: unitPrice,
    quantity: item.quantity,
    line_total: unitPrice.mul(item.quantity).toDecimalPlaces(2),
    stock_quantity: variant.stock_quantity,
    issues: itemIssues(item),
  };
}

function toCartDTO(cart) {
  const items = (cart?.items ?? []).map(toCartItemDTO);
  const subtotal = items.reduce((sum, item) => sum.add(item.line_total), toDecimal(0));

  return {
    id: cart?.id ?? null,
    items,
    item_count: items.length,
    total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: subtotal.toDecimalPlaces(2),
    // Cảnh báo để trang giỏ hàng hiện ngay, không đợi tới lúc bấm đặt hàng.
    warnings: items
      .filter((item) => item.issues.length > 0)
      .map((item) => ({ variant_id: item.variant_id, sku: item.sku, messages: item.issues })),
  };
}

const getCart = async (userId) => {
  const customer = await getCustomerOrFail(userId);
  return toCartDTO(await repo.ensureCart(customer.id));
};

/**
 * Chạy một thao tác sửa giỏ trong transaction, sau khi đã khóa dòng giỏ — cùng khóa
 * mà checkout lấy. Nhờ vậy sửa giỏ không chen vào giữa lúc checkout đang chốt giỏ
 * (không mất thay đổi, không sửa dòng vừa bị checkout xóa), và hai lần thêm cùng
 * variant đồng thời được cộng dồn thay vì đụng unique (cart_id, variant_id).
 */
async function withLockedCart(customerId, fn) {
  // Giỏ cũ có thể chưa tồn tại (khách tạo trước khi có cart) — tạo trước khi khóa.
  await repo.ensureCart(customerId);
  return prisma.$transaction(async (tx) => {
    const cart = await repo.lockCartForUpdate(tx, customerId);
    if (!cart) throw AppError.notFound('Cart not found');
    return fn(tx, cart);
  });
}

async function addItem(userId, { variant_id, quantity }) {
  const customer = await getCustomerOrFail(userId);

  await withLockedCart(customer.id, async (tx, cart) => {
    const variant = await repo.findVariantForCart(variant_id, tx);
    if (!variant) throw AppError.notFound('Variant not found');
    if (variant.status !== 'ACTIVE' || variant.product.status !== 'ACTIVE' || variant.product.deleted_at) {
      throw AppError.conflict('This product is not available for sale');
    }

    const existing = await repo.findItemByVariant(cart.id, variant_id, tx);
    // Thêm lại variant đã có thì cộng dồn, và tổng sau khi cộng vẫn phải <= tồn kho.
    const nextQuantity = (existing?.quantity ?? 0) + quantity;

    if (nextQuantity > variant.stock_quantity) {
      throw AppError.unprocessable(
        `Quantity exceeds available stock: ${variant.stock_quantity} left for ${variant.sku}` +
          (existing ? ` (cart already has ${existing.quantity})` : '')
      );
    }

    if (existing) {
      await repo.updateItemQuantity(existing.id, nextQuantity, tx);
    } else {
      await repo.createItem({ cart_id: cart.id, variant_id, quantity }, tx);
    }
  });

  return toCartDTO(await repo.findCartWithItems(customer.id));
}

/** Đọc dòng giỏ SAU khi đã khóa giỏ (gọi bên trong withLockedCart). */
async function getOwnedItem(tx, cart, itemId) {
  const item = await repo.findItem(itemId, tx);
  if (!item) throw AppError.notFound('Cart item not found');
  // Không cho sửa dòng trong giỏ của người khác.
  if (item.cart_id !== cart.id) throw AppError.forbidden('This item does not belong to your cart');
  return item;
}

async function updateItem(userId, itemId, quantity) {
  const customer = await getCustomerOrFail(userId);

  await withLockedCart(customer.id, async (tx, cart) => {
    const item = await getOwnedItem(tx, cart, itemId);

    const variant = await repo.findVariantForCart(item.variant_id, tx);
    if (quantity > variant.stock_quantity) {
      throw AppError.unprocessable(
        `Quantity exceeds available stock: ${variant.stock_quantity} left for ${variant.sku}`
      );
    }

    await repo.updateItemQuantity(itemId, quantity, tx);
  });

  return toCartDTO(await repo.findCartWithItems(customer.id));
}

async function removeItem(userId, itemId) {
  const customer = await getCustomerOrFail(userId);

  await withLockedCart(customer.id, async (tx, cart) => {
    await getOwnedItem(tx, cart, itemId);
    await repo.deleteItem(itemId, tx);
  });

  return toCartDTO(await repo.findCartWithItems(customer.id));
}

async function clear(userId) {
  const customer = await getCustomerOrFail(userId);
  await withLockedCart(customer.id, (tx, cart) => repo.clearItems(cart.id, tx));
  return toCartDTO(await repo.findCartWithItems(customer.id));
}

/**
 * Tính tiền trước khi đặt hàng: subtotal, giảm giá, phí ship, tổng.
 * Không ghi gì vào DB — lượt dùng mã chỉ bị trừ khi đặt hàng thật.
 */
async function preview(userId, { promotion_code } = {}) {
  const customer = await getCustomerOrFail(userId);
  const cart = toCartDTO(await repo.ensureCart(customer.id));

  const subtotal = toDecimal(cart.subtotal);
  let promotion = null;
  let discount = toDecimal(0);
  let promotionError = null;

  if (promotion_code) {
    try {
      const result = await promotionService.validateForCustomer({
        code: promotion_code,
        subtotal,
        customerId: customer.id,
      });
      promotion = promotionService.toPromotionDTO(result.promotion);
      discount = toDecimal(result.discount_amount);
    } catch (error) {
      // Mã không dùng được thì vẫn trả bảng giá (chưa giảm) kèm lý do,
      // để trang giỏ hàng không trắng xóa chỉ vì nhập sai mã.
      if (error.statusCode === 404 || error.statusCode === 422) {
        promotionError = error.message;
      } else {
        throw error;
      }
    }
  }

  const shippingFee = cart.items.length > 0 ? toDecimal(env.DEFAULT_SHIPPING_FEE) : toDecimal(0);
  const total = subtotal.sub(discount).add(shippingFee);

  return {
    ...cart,
    promotion,
    promotion_error: promotionError,
    discount_amount: discount.toDecimalPlaces(2),
    shipping_fee: shippingFee.toDecimalPlaces(2),
    total_amount: total.toDecimalPlaces(2),
  };
}

module.exports = {
  effectivePrice,
  toCartDTO,
  getCustomerOrFail,
  getCart,
  addItem,
  updateItem,
  removeItem,
  clear,
  preview,
};
