'use strict';

const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { prisma } = require('../../config/database');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const inventoryService = require('../inventory/inventory.service');
const promotionService = require('../promotions/promotion.service');
const customerRepo = require('../customers/customer.repository');
const cartRepo = require('../carts/cart.repository');
const cartService = require('../carts/cart.service');
const {
  ORDER_STATUS,
  STATUS_TRANSITIONS,
  CUSTOMER_CANCELLABLE,
  STAFF_CANCELLABLE,
  isValidTransition,
} = require('./order.constant');
const repo = require('./order.repository');

const toDecimal = (value) => new Prisma.Decimal(value ?? 0);
const SORTABLE = ['created_at', 'total_amount', 'status'];

/** Mã đơn dễ đọc, sinh từ id sau khi insert nên không bao giờ trùng. */
const buildOrderCode = (id, createdAt) => {
  const date = createdAt.toISOString().slice(0, 10).replace(/-/g, '');
  return `PS${date}-${String(id).padStart(5, '0')}`;
};

function toOrderDTO(order) {
  if (!order) return null;
  const { customer, details, payment, promotion, ...rest } = order;

  return {
    ...rest,
    customer: customer
      ? {
          id: customer.id,
          full_name: customer.user.full_name,
          email: customer.user.email,
          phone: customer.user.phone,
        }
      : null,
    details: details ?? [],
    item_count: details?.length ?? 0,
    payment: payment
      ? {
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          paid_at: payment.paid_at,
        }
      : null,
    promotion: promotion ?? null,
    // Gợi ý cho UI biết nút nào nên hiện; backend vẫn là nơi chốt.
    allowed_transitions: STATUS_TRANSITIONS[order.status] ?? [],
  };
}

function toOrderListDTO(order) {
  const { customer, payment, _count, ...rest } = order;
  return {
    ...rest,
    customer: customer
      ? { id: customer.id, full_name: customer.user.full_name, email: customer.user.email }
      : null,
    payment: payment ? { method: payment.method, status: payment.status } : null,
    item_count: _count?.details ?? 0,
    allowed_transitions: STATUS_TRANSITIONS[order.status] ?? [],
  };
}

/**
 * Đặt hàng — toàn bộ trong MỘT transaction (CLAUDE.md §7):
 *   kiểm tra giỏ → kiểm tra lại tồn kho → tạo đơn + chi tiết (snapshot giá)
 *   → trừ kho + ghi SALE → tạo payment → trừ lượt khuyến mãi → xóa giỏ
 * Bất kỳ bước nào fail thì không có gì được ghi: không có đơn mồ côi, kho không lệch.
 */
async function createOrder(userId, payload) {
  const customer = await cartService.getCustomerOrFail(userId);

  const orderId = await prisma.$transaction(async (tx) => {
    const cart = await cartRepo.findCartWithItems(customer.id, tx);
    if (!cart || cart.items.length === 0) throw AppError.conflict('Cart is empty');

    // Chặn sản phẩm đã bị ẩn/xóa sau khi khách thêm vào giỏ.
    for (const item of cart.items) {
      const product = item.variant.product;
      if (product.deleted_at || product.status !== 'ACTIVE' || item.variant.status !== 'ACTIVE') {
        throw AppError.unprocessable(`${item.variant.sku} is no longer available for sale`);
      }
    }

    // Snapshot giá + thông tin tại thời điểm đặt. Đổi giá sau này không ảnh hưởng đơn cũ.
    const detailRows = cart.items.map((item) => {
      const unitPrice = cartService.effectivePrice(item.variant);
      return {
        variant_id: item.variant.id,
        product_name: item.variant.product.name,
        sku: item.variant.sku,
        volume_ml: item.variant.volume_ml,
        unit_price: unitPrice,
        quantity: item.quantity,
        line_total: unitPrice.mul(item.quantity).toDecimalPlaces(2),
      };
    });

    const subtotal = detailRows
      .reduce((sum, row) => sum.add(row.line_total), toDecimal(0))
      .toDecimalPlaces(2);

    let promotionId = null;
    let promotionCode = null;
    let discount = toDecimal(0);

    if (payload.promotion_code) {
      const claimed = await promotionService.claimForOrder(tx, {
        code: payload.promotion_code,
        subtotal,
        customerId: customer.id,
      });
      promotionId = claimed.promotion.id;
      promotionCode = claimed.promotion.code;
      discount = toDecimal(claimed.discount_amount);
    }

    const shippingFee = toDecimal(env.DEFAULT_SHIPPING_FEE);
    const totalAmount = subtotal.sub(discount).add(shippingFee).toDecimalPlaces(2);

    const order = await repo.createOrder(tx, {
      // Mã tạm duy nhất, ghi lại mã đẹp ngay sau khi có id.
      // 20 ký tự — phải vừa cột VarChar(32).
      order_code: `TMP-${crypto.randomBytes(8).toString('hex')}`,
      customer_id: customer.id,
      status: ORDER_STATUS.PENDING,
      receiver_name: payload.receiver_name,
      receiver_phone: payload.receiver_phone,
      shipping_address: payload.shipping_address,
      note: payload.note ?? null,
      subtotal,
      discount_amount: discount,
      shipping_fee: shippingFee,
      total_amount: totalAmount,
      promotion_id: promotionId,
      promotion_code: promotionCode,
    });

    await repo.updateOrderCode(tx, order.id, buildOrderCode(order.id, order.created_at));
    await repo.createDetails(tx, detailRows.map((row) => ({ ...row, order_id: order.id })));

    // Trừ kho qua đúng primitive của module kho: kiểm tra lại tồn (chống bán
    // quá hàng khi kho đã đổi từ lúc thêm giỏ) và ghi transaction SALE.
    for (const row of detailRows) {
      await inventoryService.applyStockMovement(tx, {
        variant_id: row.variant_id,
        type: 'SALE',
        quantity: row.quantity,
        reference: `ORDER:${order.id}`,
        note: `Bán theo đơn ${buildOrderCode(order.id, order.created_at)}`,
        created_by: userId,
      });
    }

    await repo.createPayment(tx, {
      order_id: order.id,
      method: payload.payment_method,
      status: 'UNPAID',
      amount: totalAmount,
    });

    if (promotionId) {
      await promotionService.recordUsage(tx, {
        promotion_id: promotionId,
        customer_id: customer.id,
        order_id: order.id,
        discount_amount: discount,
      });
    }

    await cartRepo.clearItems(cart.id, tx);

    return order.id;
  });

  return toOrderDTO(await repo.findById(orderId));
}

async function listMyOrders(userId, query) {
  const customer = await cartService.getCustomerOrFail(userId);
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
  });

  const { items, total } = await repo.findMany({
    filters: { customer_id: customer.id, status: query.status },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items.map(toOrderListDTO), total, { page, limit });
}

async function list(query) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
  });

  const { items, total } = await repo.findMany({
    filters: {
      q: query.q,
      status: query.status,
      from: query.from,
      to: query.to,
      customer_id: query.customer_id,
    },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items.map(toOrderListDTO), total, { page, limit });
}

/** Khách chỉ xem được đơn của mình; ADMIN/STAFF xem được mọi đơn. */
async function detail(orderId, { userId, isStaff }) {
  const order = await repo.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');

  if (!isStaff) {
    const customer = await cartService.getCustomerOrFail(userId);
    if (order.customer_id !== customer.id) {
      throw AppError.forbidden('This order does not belong to you');
    }
  }

  return toOrderDTO(order);
}

/** Cộng lại kho cho mọi dòng của đơn, ghi transaction RETURN. */
async function restoreStock(tx, order, userId, reasonLabel) {
  const details = await repo.findDetails(order.id, tx);
  for (const detail of details) {
    await inventoryService.applyStockMovement(tx, {
      variant_id: detail.variant_id,
      type: 'RETURN',
      quantity: detail.quantity,
      reference: `ORDER:${order.id}`,
      note: `${reasonLabel} đơn ${order.order_code}`,
      created_by: userId,
    });
  }
}

/**
 * Đổi trạng thái đơn. Mọi nhánh làm thay đổi kho hoặc số liệu khách đều nằm
 * trong cùng transaction với việc đổi trạng thái.
 */
async function changeStatus(orderId, nextStatus, { userId, isStaff, reason, note }) {
  await prisma.$transaction(async (tx) => {
    const order = await repo.lockOrderForUpdate(tx, orderId);
    if (!order) throw AppError.notFound('Order not found');

    if (!isStaff) {
      const customer = await cartService.getCustomerOrFail(userId);
      if (order.customer_id !== customer.id) {
        throw AppError.forbidden('This order does not belong to you');
      }
    }

    if (!isValidTransition(order.status, nextStatus)) {
      throw AppError.conflict(`Invalid status transition ${order.status} → ${nextStatus}`);
    }

    // Quyền hủy khác nhau giữa khách và nhân viên.
    if (nextStatus === ORDER_STATUS.CANCELLED) {
      const allowed = isStaff ? STAFF_CANCELLABLE : CUSTOMER_CANCELLABLE;
      if (!allowed.includes(order.status)) {
        throw AppError.conflict(`Cannot cancel order in status ${order.status}`);
      }
    }

    const data = { status: nextStatus };
    if (note) data.note = note;

    if (nextStatus === ORDER_STATUS.CONFIRMED) data.confirmed_at = new Date();

    if (nextStatus === ORDER_STATUS.CANCELLED) {
      data.cancelled_reason = reason ?? null;
      await restoreStock(tx, order, userId, 'Hủy');
      await promotionService.releaseForOrder(tx, order);
      // Chỉ hoàn tiền khi đã thu tiền. Đơn COD chưa thu thì giữ UNPAID —
      // ghi REFUNDED cho đơn chưa trả tiền là sai sổ sách.
      const payment = await tx.payment.findUnique({ where: { order_id: order.id } });
      if (payment?.status === 'PAID') {
        await repo.updatePayment(tx, order.id, { status: 'REFUNDED' });
      }
    }

    if (nextStatus === ORDER_STATUS.RETURNED) {
      data.cancelled_reason = reason ?? null;
      await restoreStock(tx, order, userId, 'Trả hàng');
      await promotionService.releaseForOrder(tx, order);
      // Đơn RETURNED đi từ COMPLETED nên tiền đã thu → hoàn lại.
      const payment = await tx.payment.findUnique({ where: { order_id: order.id } });
      if (payment?.status === 'PAID') {
        await repo.updatePayment(tx, order.id, { status: 'REFUNDED' });
      }
    }

    if (nextStatus === ORDER_STATUS.COMPLETED) {
      data.completed_at = new Date();
      // Thu COD thì đơn hoàn thành đồng nghĩa đã thanh toán.
      await repo.updatePayment(tx, order.id, { status: 'PAID', paid_at: new Date() });
    }

    await repo.updateOrder(tx, order.id, data);

    // total_orders / total_spending chỉ tính đơn COMPLETED → tính lại ở cả hai
    // chiều (vào COMPLETED và rời COMPLETED khi trả hàng).
    if (nextStatus === ORDER_STATUS.COMPLETED || nextStatus === ORDER_STATUS.RETURNED) {
      await customerRepo.recalculateTotals(order.customer_id, tx);
    }
  });

  return toOrderDTO(await repo.findById(orderId));
}

const cancel = (orderId, { userId, isStaff, reason }) =>
  changeStatus(orderId, ORDER_STATUS.CANCELLED, { userId, isStaff, reason });

const processReturn = (orderId, { userId, reason }) =>
  changeStatus(orderId, ORDER_STATUS.RETURNED, { userId, isStaff: true, reason });

async function updatePaymentStatus(orderId, status) {
  const order = await repo.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');
  if (!order.payment) throw AppError.conflict('Order has no payment record');

  await prisma.payment.update({
    where: { order_id: orderId },
    data: { status, paid_at: status === 'PAID' ? new Date() : null },
  });

  return toOrderDTO(await repo.findById(orderId));
}

async function invoice(orderId) {
  const order = await repo.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');
  return { ...toOrderDTO(order), printed_at: new Date() };
}

module.exports = {
  buildOrderCode,
  toOrderDTO,
  toOrderListDTO,
  createOrder,
  listMyOrders,
  list,
  detail,
  changeStatus,
  cancel,
  processReturn,
  updatePaymentStatus,
  invoice,
};
