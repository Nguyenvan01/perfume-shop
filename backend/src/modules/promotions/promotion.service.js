'use strict';

const { Prisma } = require('@prisma/client');
const AppError = require('../../utils/AppError');
const repo = require('./promotion.repository');

const toDecimal = (value) => new Prisma.Decimal(value ?? 0);

/**
 * Tính tiền giảm theo loại khuyến mãi.
 * PERCENTAGE bị chặn bởi max_discount; mọi loại đều không vượt quá subtotal
 * (không bao giờ để tổng đơn âm).
 */
function calculateDiscount(promotion, subtotal) {
  const amount = toDecimal(subtotal);
  let discount;

  if (promotion.discount_type === 'PERCENTAGE') {
    discount = amount.mul(toDecimal(promotion.discount_value)).div(100);
    if (promotion.max_discount != null) {
      const cap = toDecimal(promotion.max_discount);
      if (discount.greaterThan(cap)) discount = cap;
    }
  } else {
    discount = toDecimal(promotion.discount_value);
  }

  if (discount.greaterThan(amount)) discount = amount;
  return discount.toDecimalPlaces(2);
}

/**
 * Kiểm tra mã có dùng được cho đơn này không. Mỗi rule trả message riêng để
 * khách biết vì sao mã không áp dụng được (contract §2.13).
 *
 * @param {object} promotion bản ghi promotion (đã khóa hoặc chưa, tùy ngữ cảnh)
 * @param {object} options
 * @param {number|Prisma.Decimal} options.subtotal
 * @param {number} options.customerUsageCount số lần khách này đã dùng mã
 * @param {Date} [options.now]
 */
function assertUsable(promotion, { subtotal, customerUsageCount, now = new Date() }) {
  if (promotion.status !== 'ACTIVE') {
    throw AppError.unprocessable('Promotion is not active');
  }
  if (now < new Date(promotion.start_date)) {
    throw AppError.unprocessable('Promotion has not started');
  }
  if (now > new Date(promotion.end_date)) {
    throw AppError.unprocessable('Promotion has expired');
  }
  if (promotion.usage_limit != null && promotion.used_count >= promotion.usage_limit) {
    throw AppError.unprocessable('Usage limit reached');
  }
  if (toDecimal(subtotal).lessThan(toDecimal(promotion.minimum_order_value))) {
    throw AppError.unprocessable(
      `Order does not meet minimum value of ${promotion.minimum_order_value}`
    );
  }
  if (promotion.per_customer_limit != null && customerUsageCount >= promotion.per_customer_limit) {
    throw AppError.unprocessable('You have already used this promotion');
  }
}

/** Dùng cho /cart/preview và /promotions/validate — chỉ đọc, không ghi. */
async function validateForCustomer({ code, subtotal, customerId }) {
  const promotion = await repo.findByCode(code);
  if (!promotion) throw AppError.notFound('Promotion code not found');

  const customerUsageCount = customerId
    ? await repo.countCustomerUsage(promotion.id, customerId)
    : 0;

  assertUsable(promotion, { subtotal, customerUsageCount });

  return { promotion, discount_amount: calculateDiscount(promotion, subtotal) };
}

/**
 * Dùng trong transaction checkout: khóa dòng promotion, validate lại rồi tăng
 * used_count. Khóa là bắt buộc — nếu không, hai khách có thể cùng lấy lượt cuối.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function claimForOrder(tx, { code, subtotal, customerId }) {
  const promotion = await repo.lockByCodeForUpdate(tx, code);
  if (!promotion) throw AppError.notFound('Promotion code not found');

  const customerUsageCount = await repo.countCustomerUsage(promotion.id, customerId, tx);
  assertUsable(promotion, { subtotal, customerUsageCount });

  const discount = calculateDiscount(promotion, subtotal);
  await repo.incrementUsedCount(tx, promotion.id, 1);

  return { promotion, discount_amount: discount };
}

/** Hủy đơn / trả hàng: nhả lại lượt dùng để khách dùng mã cho đơn khác. */
async function releaseForOrder(tx, order) {
  if (!order.promotion_id) return;
  await repo.deleteUsageByOrder(tx, order.id);
  await repo.incrementUsedCount(tx, order.promotion_id, -1);
}

const recordUsage = (tx, { promotion_id, customer_id, order_id, discount_amount }) =>
  repo.createUsage(tx, { promotion_id, customer_id, order_id, discount_amount });

function toPromotionDTO(promotion) {
  if (!promotion) return null;
  return {
    id: promotion.id,
    code: promotion.code,
    name: promotion.name,
    discount_type: promotion.discount_type,
    discount_value: promotion.discount_value,
    minimum_order_value: promotion.minimum_order_value,
    max_discount: promotion.max_discount,
    start_date: promotion.start_date,
    end_date: promotion.end_date,
    usage_limit: promotion.usage_limit,
    per_customer_limit: promotion.per_customer_limit,
    used_count: promotion.used_count,
    status: promotion.status,
  };
}

module.exports = {
  calculateDiscount,
  assertUsable,
  validateForCustomer,
  claimForOrder,
  releaseForOrder,
  recordUsage,
  toPromotionDTO,
};
