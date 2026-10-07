'use strict';

const { prisma } = require('../../config/database');

const REVIEW_SELECT = {
  id: true,
  product_id: true,
  customer_id: true,
  order_id: true,
  rating: true,
  comment: true,
  is_hidden: true,
  created_at: true,
  updated_at: true,
  customer: { select: { id: true, user: { select: { full_name: true } } } },
};

const findProduct = (id) => prisma.product.findFirst({ where: { id, deleted_at: null } });

const findCustomerByUserId = (user_id) => prisma.customer.findUnique({ where: { user_id } });

/**
 * Tìm đơn COMPLETED của khách có chứa sản phẩm này.
 * Đây là bằng chứng "đã mua" — không có thì không được đánh giá (CLAUDE.md §7).
 */
const findPurchaseOrder = (customer_id, product_id) =>
  prisma.order.findFirst({
    where: {
      customer_id,
      status: 'COMPLETED',
      details: { some: { variant: { product_id } } },
    },
    orderBy: { completed_at: 'desc' },
    select: { id: true, order_code: true, completed_at: true },
  });

function buildWhere({ product_id, rating, is_hidden, publicOnly }) {
  const where = {};
  if (product_id) where.product_id = product_id;
  if (rating) where.rating = rating;
  // Khách không thấy review đã bị ẩn; admin thấy tất cả.
  if (publicOnly) where.is_hidden = false;
  else if (is_hidden !== undefined) where.is_hidden = is_hidden;
  return where;
}

async function findMany({ filters, skip, take }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take,
      orderBy: { created_at: 'desc' },
      select: {
        ...REVIEW_SELECT,
        product: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);
  return { items, total };
}

/** Điểm trung bình + phân bố 1-5 sao, tính bằng aggregate chứ không cộng trong JS. */
async function summary(product_id) {
  const [aggregate, breakdown] = await Promise.all([
    prisma.review.aggregate({
      where: { product_id, is_hidden: false },
      _avg: { rating: true },
      _count: { id: true },
    }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { product_id, is_hidden: false },
      _count: { rating: true },
    }),
  ]);

  const counts = Object.fromEntries(breakdown.map((row) => [row.rating, row._count.rating]));

  return {
    average: aggregate._avg.rating == null ? 0 : Number(aggregate._avg.rating.toFixed(2)),
    total: aggregate._count.id,
    // Luôn trả đủ 5 bậc kể cả bậc có 0 review, để thanh phân bố không nhảy.
    breakdown: [5, 4, 3, 2, 1].map((star) => ({ rating: star, count: counts[star] ?? 0 })),
  };
}

const findById = (id) => prisma.review.findUnique({ where: { id }, select: REVIEW_SELECT });

const findByProductAndCustomer = (product_id, customer_id) =>
  prisma.review.findUnique({
    where: { product_id_customer_id: { product_id, customer_id } },
    select: { id: true },
  });

const create = (data) => prisma.review.create({ data, select: REVIEW_SELECT });

const update = (id, data) => prisma.review.update({ where: { id }, data, select: REVIEW_SELECT });

const remove = (id) => prisma.review.delete({ where: { id } });

module.exports = {
  REVIEW_SELECT,
  findProduct,
  findCustomerByUserId,
  findPurchaseOrder,
  findMany,
  summary,
  findById,
  findByProductAndCustomer,
  create,
  update,
  remove,
};
