'use strict';

const { Prisma } = require('@prisma/client');
const env = require('../../config/env');
const { resolveRange, previousRange, daysInRange } = require('../../utils/dateRange');
const repo = require('./report.repository');

const toNumber = (value) => Number(value ?? 0);
const toDecimal = (value) => new Prisma.Decimal(value ?? 0);

/** Phần trăm thay đổi so với kỳ trước. null khi kỳ trước bằng 0 (chia 0 vô nghĩa). */
function changePercent(current, previous) {
  const now = toDecimal(current);
  const before = toDecimal(previous);
  if (before.isZero()) return now.isZero() ? 0 : null;
  return Number(now.sub(before).div(before).mul(100).toDecimalPlaces(1));
}

async function dashboard(query) {
  const range = resolveRange(query);
  const previous = previousRange(range);

  const [current, prior, ordersCreated, newCustomers, totalCustomers, products, pending, lowStock] =
    await Promise.all([
      repo.completedRevenue(range),
      repo.completedRevenue(previous),
      repo.countOrdersCreated(range),
      repo.countNewCustomers(range),
      repo.countTotalCustomers(),
      repo.countActiveProducts(),
      repo.countPendingOrders(),
      repo.countLowStock(),
    ]);

  return {
    range: { range: range.range, from: range.from, to: range.to },
    revenue: current.revenue,
    // Tổng tiền thu được: đã trừ giảm giá, đã gồm phí ship.
    revenue_basis: 'order_total_including_shipping',
    revenue_change_pct: changePercent(current.revenue, prior.revenue),
    // `order_count` là đơn TẠO trong kỳ; `completed_order_count` là đơn hoàn thành
    // trong kỳ — hai con số khác nhau, đừng dùng lẫn.
    order_count: ordersCreated,
    completed_order_count: current.completed_order_count,
    new_customer_count: newCustomers,
    customer_count: totalCustomers,
    product_count: products,
    pending_order_count: pending,
    low_stock_count: lowStock,
    low_stock_threshold: env.LOW_STOCK_THRESHOLD,
  };
}

async function revenue(query) {
  const range = resolveRange(query);
  // Khoảng dài hơn 90 ngày thì gom theo tháng cho biểu đồ đọc được.
  const groupBy = query.group_by ?? (daysInRange(range) > 90 ? 'month' : 'day');

  const rows = await repo.revenueSeries({ ...range, groupBy });

  return {
    range: { range: range.range, from: range.from, to: range.to },
    group_by: groupBy,
    series: rows.map((row) => ({
      period: row.period instanceof Date ? row.period.toISOString().slice(0, 10) : String(row.period),
      revenue: toDecimal(row.revenue),
      order_count: toNumber(row.order_count),
    })),
  };
}

async function topProducts(query) {
  const range = resolveRange(query);
  const rows = await repo.topProducts({ ...range, limit: query.limit ?? 10 });

  return {
    range: { range: range.range, from: range.from, to: range.to },
    items: rows.map((row) => ({
      product_id: toNumber(row.product_id),
      product_name: row.product_name,
      brand_name: row.brand_name,
      quantity_sold: toNumber(row.quantity_sold),
      revenue: toDecimal(row.revenue),
    })),
  };
}

/**
 * Doanh thu theo thương hiệu cộng từ `order_details.line_total` — tức là tiền
 * HÀNG, không gồm phí vận chuyển và chưa trừ giảm giá toàn đơn (hai khoản đó
 * không thuộc về thương hiệu nào).
 *
 * Nên tổng ở đây nhỏ hơn `revenue` của dashboard (cộng `orders.total_amount`).
 * Đây là chênh lệch có chủ ý, không phải sai số — `basis` nói rõ cho client.
 */
async function revenueByBrand(query) {
  const range = resolveRange(query);
  const rows = await repo.revenueByBrand(range);

  const total = rows.reduce((sum, row) => sum.add(toDecimal(row.revenue)), toDecimal(0));

  return {
    range: { range: range.range, from: range.from, to: range.to },
    total_revenue: total,
    basis: 'product_revenue_excluding_shipping_and_discount',
    items: rows.map((row) => ({
      brand_id: toNumber(row.brand_id),
      brand_name: row.brand_name,
      revenue: toDecimal(row.revenue),
      order_count: toNumber(row.order_count),
      share_pct: total.isZero()
        ? 0
        : Number(toDecimal(row.revenue).div(total).mul(100).toDecimalPlaces(1)),
    })),
  };
}

async function orderStatus(query) {
  const range = resolveRange(query);
  const rows = await repo.countOrdersByStatus(range);

  const counts = Object.fromEntries(rows.map((row) => [row.status, row._count.status]));
  const ALL = ['PENDING', 'CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'RETURNED'];

  return {
    range: { range: range.range, from: range.from, to: range.to },
    // Trả đủ 7 trạng thái kể cả khi count = 0, để biểu đồ không nhảy cột.
    items: ALL.map((status) => ({ status, count: counts[status] ?? 0 })),
    total: rows.reduce((sum, row) => sum + row._count.status, 0),
  };
}

async function lowStock(query) {
  const rows = await repo.lowStockVariants(query.limit ?? 20);

  return {
    low_stock_threshold: env.LOW_STOCK_THRESHOLD,
    items: rows.map((row) => ({
      variant_id: row.id,
      sku: row.sku,
      volume_ml: row.volume_ml,
      stock_quantity: row.stock_quantity,
      product_id: row.product.id,
      product_name: row.product.name,
      brand_name: row.product.brand?.name ?? null,
    })),
  };
}

module.exports = { dashboard, revenue, topProducts, revenueByBrand, orderStatus, lowStock };
