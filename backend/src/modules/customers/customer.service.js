'use strict';

const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const repo = require('./customer.repository');

const SORTABLE = ['created_at', 'total_spending', 'total_orders'];

/** CustomerDTO theo contract §2.10: gộp phẳng thông tin user vào customer. */
function toCustomerDTO(customer) {
  if (!customer) return null;
  const { user, ...rest } = customer;

  return {
    ...rest,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    user_created_at: user.created_at,
  };
}

function toOrderSummaryDTO(order) {
  const { _count, ...rest } = order;
  return { ...rest, item_count: _count?.details ?? 0 };
}

async function list(query) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
  });

  const { items, total } = await repo.findMany({
    filters: { q: query.q, status: query.status },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items.map(toCustomerDTO), total, { page, limit });
}

async function detail(id) {
  const customer = await repo.findById(id);
  if (!customer) throw AppError.notFound('Customer not found');

  const [recentOrders, statusCounts] = await Promise.all([
    repo.findRecentOrders(id),
    repo.countOrdersByStatus(id),
  ]);

  return {
    ...toCustomerDTO(customer),
    recent_orders: recentOrders.map(toOrderSummaryDTO),
    order_status_counts: statusCounts.map((row) => ({
      status: row.status,
      count: row._count.status,
    })),
  };
}

async function listOrders(id, query) {
  const customer = await repo.findById(id);
  if (!customer) throw AppError.notFound('Customer not found');

  const { page, limit, skip, take } = parsePagination(query);
  const { items, total } = await repo.findOrders({
    customer_id: id,
    status: query.status,
    skip,
    take,
  });

  return buildPaginatedResult(items.map(toOrderSummaryDTO), total, { page, limit });
}

async function setStatus(id, status, actorUserId) {
  const customer = await repo.findById(id);
  if (!customer) throw AppError.notFound('Customer not found');

  if (customer.user_id === actorUserId) {
    throw AppError.conflict('You cannot change your own status');
  }

  await repo.setUserStatus(customer.user_id, status);
  return toCustomerDTO(await repo.findById(id));
}

module.exports = {
  toCustomerDTO,
  toOrderSummaryDTO,
  list,
  detail,
  listOrders,
  setStatus,
  recalculateTotals: repo.recalculateTotals,
};
