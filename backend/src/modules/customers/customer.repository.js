'use strict';

const { prisma } = require('../../config/database');

const CUSTOMER_SELECT = {
  id: true,
  user_id: true,
  address: true,
  total_orders: true,
  total_spending: true,
  created_at: true,
  user: {
    select: { id: true, email: true, full_name: true, phone: true, status: true, created_at: true },
  },
};

/** Chỉ tính khách có user chưa bị xóa mềm. */
const activeUser = { user: { deleted_at: null } };

function buildWhere({ q, status }) {
  const where = { ...activeUser };

  if (q) {
    where.user = {
      deleted_at: null,
      OR: [
        { full_name: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
      ],
    };
  }
  if (status) {
    where.user = { ...(where.user ?? {}), deleted_at: null, status };
  }

  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);

  const [items, total] = await Promise.all([
    prisma.customer.findMany({ where, skip, take, orderBy, select: CUSTOMER_SELECT }),
    prisma.customer.count({ where }),
  ]);

  return { items, total };
}

const findById = (id) => prisma.customer.findUnique({ where: { id }, select: CUSTOMER_SELECT });

const ORDER_LIST_SELECT = {
  id: true,
  order_code: true,
  status: true,
  total_amount: true,
  created_at: true,
  completed_at: true,
  _count: { select: { details: true } },
};

const findRecentOrders = (customer_id, take = 5) =>
  prisma.order.findMany({
    where: { customer_id },
    orderBy: { created_at: 'desc' },
    take,
    select: ORDER_LIST_SELECT,
  });

async function findOrders({ customer_id, status, skip, take }) {
  const where = { customer_id, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      select: ORDER_LIST_SELECT,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total };
}

/** Thống kê đơn theo trạng thái — hiển thị ở trang chi tiết khách. */
const countOrdersByStatus = (customer_id) =>
  prisma.order.groupBy({
    by: ['status'],
    where: { customer_id },
    _count: { status: true },
  });

/**
 * Tính lại total_orders / total_spending từ đơn COMPLETED.
 * W5 gọi hàm này khi đơn chuyển sang COMPLETED hoặc RETURNED, nên hai field
 * denormalized này không bao giờ lệch khỏi dữ liệu đơn thật.
 * @param {import('@prisma/client').Prisma.TransactionClient} [client]
 */
async function recalculateTotals(customer_id, client = prisma) {
  const aggregate = await client.order.aggregate({
    where: { customer_id, status: 'COMPLETED' },
    _count: { id: true },
    _sum: { total_amount: true },
  });

  return client.customer.update({
    where: { id: customer_id },
    data: {
      total_orders: aggregate._count.id,
      total_spending: aggregate._sum.total_amount ?? 0,
    },
    select: CUSTOMER_SELECT,
  });
}

/** Lock/unlock khách = đổi users.status (OD-2: auth nằm ở users). */
const setUserStatus = (user_id, status) =>
  prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user_id }, data: { status } });
    if (status === 'LOCKED') {
      await tx.refreshToken.updateMany({
        where: { user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
  });

module.exports = {
  findMany,
  findById,
  findRecentOrders,
  findOrders,
  countOrdersByStatus,
  recalculateTotals,
  setUserStatus,
};
