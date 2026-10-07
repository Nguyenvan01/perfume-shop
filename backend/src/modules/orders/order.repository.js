'use strict';

const { prisma } = require('../../config/database');

const ORDER_DETAIL_SELECT = {
  id: true,
  variant_id: true,
  product_name: true,
  sku: true,
  volume_ml: true,
  unit_price: true,
  quantity: true,
  line_total: true,
};

const ORDER_FULL_INCLUDE = {
  customer: {
    select: {
      id: true,
      address: true,
      user: { select: { id: true, full_name: true, email: true, phone: true } },
    },
  },
  details: { orderBy: { id: 'asc' }, select: ORDER_DETAIL_SELECT },
  payment: true,
  promotion: { select: { id: true, code: true, name: true } },
};

const ORDER_LIST_SELECT = {
  id: true,
  order_code: true,
  status: true,
  receiver_name: true,
  receiver_phone: true,
  subtotal: true,
  discount_amount: true,
  shipping_fee: true,
  total_amount: true,
  promotion_code: true,
  created_at: true,
  confirmed_at: true,
  completed_at: true,
  customer: { select: { id: true, user: { select: { full_name: true, email: true } } } },
  payment: { select: { method: true, status: true } },
  _count: { select: { details: true } },
};

function buildWhere({ q, status, from, to, customer_id }) {
  const where = {};

  if (status) where.status = status;
  if (customer_id) where.customer_id = customer_id;
  if (q) {
    where.OR = [
      { order_code: { contains: q } },
      { receiver_phone: { contains: q } },
      { receiver_name: { contains: q } },
      { customer: { user: { email: { contains: q } } } },
    ];
  }
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = from;
    if (to) where.created_at.lte = to;
  }

  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, skip, take, orderBy, select: ORDER_LIST_SELECT }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

const findById = (id, client = prisma) =>
  client.order.findUnique({ where: { id }, include: ORDER_FULL_INCLUDE });

/** Khóa đơn khi đổi trạng thái để hai admin không cùng xử lý một đơn. */
async function lockOrderForUpdate(tx, id) {
  const rows = await tx.$queryRaw`
    SELECT id, order_code, customer_id, status, promotion_id, total_amount
    FROM orders
    WHERE id = ${id}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

const findDetails = (order_id, client = prisma) =>
  client.orderDetail.findMany({ where: { order_id }, select: ORDER_DETAIL_SELECT });

const createOrder = (tx, data) => tx.order.create({ data });

const updateOrderCode = (tx, id, order_code) =>
  tx.order.update({ where: { id }, data: { order_code } });

const createDetails = (tx, rows) => tx.orderDetail.createMany({ data: rows });

const createPayment = (tx, data) => tx.payment.create({ data });

const updatePayment = (tx, order_id, data) =>
  tx.payment.update({ where: { order_id }, data });

const updateOrder = (tx, id, data) => tx.order.update({ where: { id }, data });

module.exports = {
  ORDER_FULL_INCLUDE,
  findMany,
  findById,
  lockOrderForUpdate,
  findDetails,
  createOrder,
  updateOrderCode,
  createDetails,
  createPayment,
  updatePayment,
  updateOrder,
};
