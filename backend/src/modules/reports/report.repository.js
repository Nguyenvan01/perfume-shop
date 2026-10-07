'use strict';

const { Prisma } = require('@prisma/client');
const { prisma } = require('../../config/database');
const env = require('../../config/env');
const { OFFSET_HOURS } = require('../../utils/dateRange');

/**
 * Offset là số nguyên từ env, đã qua readNumber() nên an toàn khi nội suy vào SQL.
 * Phải nội suy thay vì bind tham số: MySQL không nhận placeholder trong INTERVAL.
 */
const TZ = Prisma.raw(String(Number(OFFSET_HOURS)));

/** Doanh thu chỉ tính đơn COMPLETED, mốc thời gian là lúc hoàn thành đơn. */
async function completedRevenue({ from, to }) {
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS order_count
    FROM orders
    WHERE status = 'COMPLETED' AND completed_at >= ${from} AND completed_at < ${to}
  `;
  return {
    revenue: new Prisma.Decimal(rows[0]?.revenue ?? 0),
    completed_order_count: Number(rows[0]?.order_count ?? 0),
  };
}

/** Số đơn được tạo trong kỳ — khác số đơn hoàn thành trong kỳ. */
const countOrdersCreated = ({ from, to }) =>
  prisma.order.count({ where: { created_at: { gte: from, lt: to } } });

const countOrdersByStatus = ({ from, to }) =>
  prisma.order.groupBy({
    by: ['status'],
    where: { created_at: { gte: from, lt: to } },
    _count: { status: true },
  });

const countNewCustomers = ({ from, to }) =>
  prisma.customer.count({
    where: { created_at: { gte: from, lt: to }, user: { deleted_at: null } },
  });

const countTotalCustomers = () => prisma.customer.count({ where: { user: { deleted_at: null } } });

const countActiveProducts = () =>
  prisma.product.count({ where: { deleted_at: null, status: 'ACTIVE' } });

const countPendingOrders = () => prisma.order.count({ where: { status: 'PENDING' } });

const countLowStock = () =>
  prisma.productVariant.count({
    where: {
      product: { deleted_at: null },
      stock_quantity: { lte: env.LOW_STOCK_THRESHOLD },
    },
  });

/**
 * Chuỗi doanh thu theo ngày hoặc tháng. Group ngay trong SQL — không kéo hết đơn
 * về JS rồi cộng, để báo cáo vẫn nhanh khi dữ liệu lớn.
 */
async function revenueSeries({ from, to, groupBy }) {
  const period =
    groupBy === 'month'
      ? Prisma.sql`DATE_FORMAT(completed_at + INTERVAL ${TZ} HOUR, '%Y-%m')`
      : Prisma.sql`DATE(completed_at + INTERVAL ${TZ} HOUR)`;

  return prisma.$queryRaw`
    SELECT ${period} AS period,
           COALESCE(SUM(total_amount), 0) AS revenue,
           COUNT(*) AS order_count
    FROM orders
    WHERE status = 'COMPLETED' AND completed_at >= ${from} AND completed_at < ${to}
    GROUP BY period
    ORDER BY period ASC
  `;
}

/** Top sản phẩm bán chạy — lấy từ order_details (snapshot), chỉ đơn COMPLETED. */
function topProducts({ from, to, limit }) {
  return prisma.$queryRaw`
    SELECT p.id AS product_id,
           p.name AS product_name,
           b.name AS brand_name,
           SUM(d.quantity) AS quantity_sold,
           SUM(d.line_total) AS revenue
    FROM order_details d
    JOIN orders o ON o.id = d.order_id
    JOIN product_variants v ON v.id = d.variant_id
    JOIN products p ON p.id = v.product_id
    JOIN brands b ON b.id = p.brand_id
    WHERE o.status = 'COMPLETED' AND o.completed_at >= ${from} AND o.completed_at < ${to}
    GROUP BY p.id, p.name, b.name
    ORDER BY quantity_sold DESC, revenue DESC
    LIMIT ${limit}
  `;
}

function revenueByBrand({ from, to }) {
  return prisma.$queryRaw`
    SELECT b.id AS brand_id,
           b.name AS brand_name,
           SUM(d.line_total) AS revenue,
           COUNT(DISTINCT o.id) AS order_count
    FROM order_details d
    JOIN orders o ON o.id = d.order_id
    JOIN product_variants v ON v.id = d.variant_id
    JOIN products p ON p.id = v.product_id
    JOIN brands b ON b.id = p.brand_id
    WHERE o.status = 'COMPLETED' AND o.completed_at >= ${from} AND o.completed_at < ${to}
    GROUP BY b.id, b.name
    ORDER BY revenue DESC
  `;
}

function lowStockVariants(limit) {
  return prisma.productVariant.findMany({
    where: { product: { deleted_at: null }, stock_quantity: { lte: env.LOW_STOCK_THRESHOLD } },
    orderBy: { stock_quantity: 'asc' },
    take: limit,
    select: {
      id: true,
      sku: true,
      volume_ml: true,
      stock_quantity: true,
      product: { select: { id: true, name: true, brand: { select: { name: true } } } },
    },
  });
}

module.exports = {
  completedRevenue,
  countOrdersCreated,
  countOrdersByStatus,
  countNewCustomers,
  countTotalCustomers,
  countActiveProducts,
  countPendingOrders,
  countLowStock,
  revenueSeries,
  topProducts,
  revenueByBrand,
  lowStockVariants,
};
