'use strict';

const { prisma } = require('../../src/config/database');

let orderCounter = 0;

/**
 * Tạo đơn hàng trực tiếp trong DB để test các module ĐỌC đơn (customers, reports)
 * trước khi module orders tồn tại ở W5. Không dùng cho test nghiệp vụ đặt hàng.
 */
async function createOrder({
  customerId,
  status = 'COMPLETED',
  totalAmount = 1000000,
  items = [],
  createdAt,
}) {
  orderCounter += 1;

  const order = await prisma.order.create({
    data: {
      order_code: `TEST-${Date.now()}-${orderCounter}`,
      customer_id: customerId,
      status,
      receiver_name: 'Người nhận test',
      receiver_phone: '0900000000',
      shipping_address: '1 Đường Test',
      subtotal: totalAmount,
      total_amount: totalAmount,
      ...(createdAt ? { created_at: createdAt } : {}),
      ...(status === 'COMPLETED' ? { completed_at: createdAt ?? new Date() } : {}),
      details: {
        create: items.map((item) => ({
          variant_id: item.variant_id,
          product_name: item.product_name ?? 'Sản phẩm test',
          sku: item.sku ?? `SKU-${item.variant_id}`,
          volume_ml: item.volume_ml ?? 100,
          unit_price: item.unit_price ?? totalAmount,
          quantity: item.quantity ?? 1,
          line_total: (item.unit_price ?? totalAmount) * (item.quantity ?? 1),
        })),
      },
    },
    include: { details: true },
  });

  return order;
}

module.exports = { createOrder };
