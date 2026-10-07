'use strict';

const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const repo = require('./review.repository');

/** DTO: chỉ lộ tên khách, không lộ email hay id người dùng. */
function toReviewDTO(review) {
  if (!review) return null;
  const { customer, product, ...rest } = review;

  return {
    ...rest,
    customer: customer ? { id: customer.id, full_name: customer.user.full_name } : null,
    ...(product ? { product } : {}),
  };
}

async function getCustomerOrFail(userId) {
  const customer = await repo.findCustomerByUserId(userId);
  if (!customer) throw AppError.forbidden('Only customer accounts can review products');
  return customer;
}

async function assertProductExists(productId) {
  const product = await repo.findProduct(productId);
  if (!product) throw AppError.notFound('Product not found');
  return product;
}

/** Danh sách review công khai của một sản phẩm, kèm thống kê điểm. */
async function listByProduct(productId, query) {
  await assertProductExists(productId);

  const { page, limit, skip, take } = parsePagination(query);
  const [{ items, total }, stats] = await Promise.all([
    repo.findMany({
      filters: { product_id: productId, rating: query.rating, publicOnly: true },
      skip,
      take,
    }),
    repo.summary(productId),
  ]);

  return { ...buildPaginatedResult(items.map(toReviewDTO), total, { page, limit }), summary: stats };
}

/**
 * Cho khách biết mình có được đánh giá sản phẩm này không, và vì sao không —
 * để trang sản phẩm hiện đúng form hoặc đúng lý do, không phải thử rồi nhận lỗi.
 */
async function eligibility(userId, productId) {
  await assertProductExists(productId);

  const customer = await repo.findCustomerByUserId(userId);
  if (!customer) return { can_review: false, reason: 'NOT_CUSTOMER', my_review: null };

  const existing = await repo.findByProductAndCustomer(productId, customer.id);
  if (existing) {
    const review = await repo.findById(existing.id);
    return { can_review: false, reason: 'ALREADY_REVIEWED', my_review: toReviewDTO(review) };
  }

  const order = await repo.findPurchaseOrder(customer.id, productId);
  if (!order) return { can_review: false, reason: 'NOT_PURCHASED', my_review: null };

  return { can_review: true, reason: null, my_review: null, purchase: order };
}

async function create(userId, productId, { rating, comment }) {
  await assertProductExists(productId);
  const customer = await getCustomerOrFail(userId);

  if (await repo.findByProductAndCustomer(productId, customer.id)) {
    throw AppError.conflict('You already reviewed this product');
  }

  // Chỉ khách có đơn COMPLETED chứa sản phẩm mới được đánh giá.
  const order = await repo.findPurchaseOrder(customer.id, productId);
  if (!order) {
    throw AppError.forbidden('You must purchase and receive this product before reviewing it');
  }

  return toReviewDTO(
    await repo.create({
      product_id: productId,
      customer_id: customer.id,
      order_id: order.id,
      rating,
      comment: comment ?? null,
    })
  );
}

async function updateOwn(userId, reviewId, payload) {
  const customer = await getCustomerOrFail(userId);

  const review = await repo.findById(reviewId);
  if (!review) throw AppError.notFound('Review not found');
  if (review.customer_id !== customer.id) {
    throw AppError.forbidden('This review does not belong to you');
  }
  // Review bị admin ẩn thì khách không sửa để lách kiểm duyệt.
  if (review.is_hidden) throw AppError.conflict('This review has been hidden by the shop');

  return toReviewDTO(await repo.update(reviewId, payload));
}

// ─── Kiểm duyệt (ADMIN/STAFF) ───

async function listAll(query) {
  const { page, limit, skip, take } = parsePagination(query);

  const { items, total } = await repo.findMany({
    filters: {
      product_id: query.product_id,
      rating: query.rating,
      is_hidden: query.is_hidden,
      publicOnly: false,
    },
    skip,
    take,
  });

  return buildPaginatedResult(items.map(toReviewDTO), total, { page, limit });
}

async function setVisibility(reviewId, isHidden) {
  const review = await repo.findById(reviewId);
  if (!review) throw AppError.notFound('Review not found');
  return toReviewDTO(await repo.update(reviewId, { is_hidden: isHidden }));
}

async function remove(reviewId) {
  const review = await repo.findById(reviewId);
  if (!review) throw AppError.notFound('Review not found');
  await repo.remove(reviewId);
}

module.exports = {
  toReviewDTO,
  listByProduct,
  eligibility,
  create,
  updateOwn,
  listAll,
  setVisibility,
  remove,
};
