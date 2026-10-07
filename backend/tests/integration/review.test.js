'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs } = require('../helpers/auth');
const { createProduct } = require('../helpers/catalog');

const api = (path) => `/api/v1${path}`;

let admin;
let staff;
let customer;

const CHECKOUT = {
  receiver_name: 'Nguyễn Văn A',
  receiver_phone: '0901234567',
  shipping_address: '12 Nguyễn Huệ, Quận 1',
  payment_method: 'COD',
};

/** Mua và nhận xong một sản phẩm — điều kiện để được đánh giá. */
async function buyAndComplete(session, variantId, quantity = 1) {
  await request(app)
    .post(api('/cart/items'))
    .set(session.authHeader)
    .send({ variant_id: variantId, quantity });

  const order = await request(app).post(api('/orders')).set(session.authHeader).send(CHECKOUT);
  const id = order.body.data.id;

  for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED']) {
    await request(app)
      .patch(api(`/orders/${id}/status`))
      .set(admin.authHeader)
      .send({ status });
  }
  return order.body.data;
}

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
});

describe('Chỉ khách đã mua và nhận hàng mới được đánh giá', () => {
  it('chưa mua → 403', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-NOBUY', volume_ml: 100, price: 500_000, stock: 10 }],
    });

    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 5, comment: 'Chưa mua mà vẫn đánh giá' });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('purchase');
    expect(await prisma.review.count()).toBe(0);
  });

  it('đã mua nhưng đơn chưa hoàn thành → 403', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-PENDING', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    await request(app)
      .post(api('/cart/items'))
      .set(customer.authHeader)
      .send({ variant_id: product.variants[0].id, quantity: 1 });
    await request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT);

    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 4 });

    expect(res.status).toBe(403);
  });

  it('đơn đã hoàn thành → đánh giá được, lưu kèm order_id làm bằng chứng mua', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-OK', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    const order = await buyAndComplete(customer, product.variants[0].id);

    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 5, comment: 'Mùi rất thơm, giữ hương lâu' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ rating: 5, is_hidden: false, order_id: order.id });
    expect(res.body.data.customer.full_name).toBeTruthy();
    // Không lộ email khách trong review công khai.
    expect(JSON.stringify(res.body)).not.toContain('@test.local');
  });

  it('đánh giá sản phẩm khác trong cùng đơn vẫn được', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'REV-A', volume_ml: 30, price: 200_000, stock: 10 },
        { sku: 'REV-B', volume_ml: 100, price: 500_000, stock: 10 },
      ],
    });
    await buyAndComplete(customer, product.variants[1].id);

    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 4 });
    expect(res.status).toBe(201);
  });

  it('đánh giá lần 2 cùng sản phẩm → 409', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-DUP', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    await buyAndComplete(customer, product.variants[0].id);

    await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 5 });

    const second = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 1 });

    expect(second.status).toBe(409);
    expect(await prisma.review.count()).toBe(1);
  });

  it('ADMIN không đánh giá được (không có hồ sơ khách) → 403', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-ADMIN', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(admin.authHeader)
      .send({ rating: 5 });
    expect(res.status).toBe(403);
  });

  it('rating ngoài 1-5 hoặc thiếu → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-BAD', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    await buyAndComplete(customer, product.variants[0].id);

    for (const rating of [0, 6, -1, 2.5]) {
      const res = await request(app)
        .post(api(`/products/${product.id}/reviews`))
        .set(customer.authHeader)
        .send({ rating });
      expect(res.status).toBe(400);
    }

    const missing = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ comment: 'Không có điểm' });
    expect(missing.status).toBe(400);
  });

  it('sản phẩm không tồn tại → 404', async () => {
    const res = await request(app)
      .post(api('/products/999999/reviews'))
      .set(customer.authHeader)
      .send({ rating: 5 });
    expect(res.status).toBe(404);
  });
});

describe('GET /products/:id/reviews', () => {
  async function seedReviews() {
    const product = await createProduct({
      variants: [{ sku: 'REV-LIST', volume_ml: 100, price: 500_000, stock: 100 }],
    });
    const variantId = product.variants[0].id;

    const ratings = [5, 5, 4, 2];
    for (const [index, rating] of ratings.entries()) {
      const buyer = await loginAs('CUSTOMER', { email: `buyer${index}@test.local` });
      await buyAndComplete(buyer, variantId);
      await request(app)
        .post(api(`/products/${product.id}/reviews`))
        .set(buyer.authHeader)
        .send({ rating, comment: `Đánh giá ${rating} sao` });
    }
    return product;
  }

  it('công khai, không cần token, kèm điểm trung bình và phân bố đủ 5 bậc', async () => {
    const product = await seedReviews();

    const res = await request(app).get(api(`/products/${product.id}/reviews`));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    // (5+5+4+2)/4 = 4
    expect(res.body.summary.average).toBe(4);
    expect(res.body.summary.total).toBe(4);
    expect(res.body.summary.breakdown).toHaveLength(5);

    const byStar = Object.fromEntries(
      res.body.summary.breakdown.map((row) => [row.rating, row.count])
    );
    expect(byStar).toEqual({ 5: 2, 4: 1, 3: 0, 2: 1, 1: 0 });
  });

  it('review bị ẩn không hiện ra cho khách và không tính vào điểm', async () => {
    const product = await seedReviews();
    const twoStar = await prisma.review.findFirst({ where: { rating: 2 } });

    await request(app)
      .patch(api(`/reviews/${twoStar.id}/visibility`))
      .set(admin.authHeader)
      .send({ is_hidden: true });

    const res = await request(app).get(api(`/products/${product.id}/reviews`));

    expect(res.body.data).toHaveLength(3);
    // (5+5+4)/3 = 4.67
    expect(res.body.summary.average).toBe(4.67);
    expect(res.body.summary.total).toBe(3);
  });

  it('filter theo số sao', async () => {
    const product = await seedReviews();
    const res = await request(app).get(api(`/products/${product.id}/reviews?rating=5`));
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.every((r) => r.rating === 5)).toBe(true);
  });

  it('sản phẩm chưa có đánh giá → list rỗng, average 0, không lỗi', async () => {
    const product = await createProduct({
      variants: [{ sku: 'REV-EMPTY', volume_ml: 100, price: 100_000, stock: 5 }],
    });

    const res = await request(app).get(api(`/products/${product.id}/reviews`));
    expect(res.body.data).toEqual([]);
    expect(res.body.summary).toMatchObject({ average: 0, total: 0 });
    expect(res.body.summary.breakdown).toHaveLength(5);
  });
});

describe('GET /products/:id/reviews/eligibility', () => {
  it('chưa mua → NOT_PURCHASED', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ELIG-1', volume_ml: 100, price: 100_000, stock: 5 }],
    });

    const res = await request(app)
      .get(api(`/products/${product.id}/reviews/eligibility`))
      .set(customer.authHeader);

    expect(res.body.data).toMatchObject({ can_review: false, reason: 'NOT_PURCHASED' });
  });

  it('đã mua, chưa đánh giá → can_review true kèm thông tin đơn', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ELIG-2', volume_ml: 100, price: 100_000, stock: 5 }],
    });
    await buyAndComplete(customer, product.variants[0].id);

    const res = await request(app)
      .get(api(`/products/${product.id}/reviews/eligibility`))
      .set(customer.authHeader);

    expect(res.body.data.can_review).toBe(true);
    expect(res.body.data.purchase.order_code).toMatch(/^PS/);
  });

  it('đã đánh giá → ALREADY_REVIEWED kèm review của mình để sửa', async () => {
    const product = await createProduct({
      variants: [{ sku: 'ELIG-3', volume_ml: 100, price: 100_000, stock: 5 }],
    });
    await buyAndComplete(customer, product.variants[0].id);
    await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 4, comment: 'Tạm ổn' });

    const res = await request(app)
      .get(api(`/products/${product.id}/reviews/eligibility`))
      .set(customer.authHeader);

    expect(res.body.data).toMatchObject({ can_review: false, reason: 'ALREADY_REVIEWED' });
    expect(res.body.data.my_review.rating).toBe(4);
  });
});

describe('PUT /reviews/:id — khách sửa đánh giá của mình', () => {
  async function createOwnReview() {
    const product = await createProduct({
      variants: [{ sku: 'REV-EDIT', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    await buyAndComplete(customer, product.variants[0].id);
    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 3, comment: 'Bình thường' });
    return { product, review: res.body.data };
  }

  it('sửa được điểm và nội dung', async () => {
    const { review } = await createOwnReview();

    const res = await request(app)
      .put(api(`/reviews/${review.id}`))
      .set(customer.authHeader)
      .send({ rating: 5, comment: 'Dùng lâu thấy hay hơn' });

    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.comment).toBe('Dùng lâu thấy hay hơn');
  });

  it('không sửa được đánh giá của người khác → 403', async () => {
    const { review } = await createOwnReview();
    const other = await loginAs('CUSTOMER', { email: 'intruder-review@test.local' });

    const res = await request(app)
      .put(api(`/reviews/${review.id}`))
      .set(other.authHeader)
      .send({ rating: 1 });

    expect(res.status).toBe(403);
  });

  it('đánh giá đã bị ẩn thì khách không sửa để lách kiểm duyệt → 409', async () => {
    const { review } = await createOwnReview();
    await request(app)
      .patch(api(`/reviews/${review.id}/visibility`))
      .set(admin.authHeader)
      .send({ is_hidden: true });

    const res = await request(app)
      .put(api(`/reviews/${review.id}`))
      .set(customer.authHeader)
      .send({ rating: 5, comment: 'Sửa cho khỏi bị ẩn' });

    expect(res.status).toBe(409);
  });

  it('body rỗng → 400', async () => {
    const { review } = await createOwnReview();
    const res = await request(app)
      .put(api(`/reviews/${review.id}`))
      .set(customer.authHeader)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Kiểm duyệt đánh giá', () => {
  async function seedOne(rating = 1, comment = 'Nội dung không phù hợp') {
    const product = await createProduct({
      variants: [{ sku: `MOD-${rating}-${Date.now()}`, volume_ml: 100, price: 100_000, stock: 10 }],
    });
    await buyAndComplete(customer, product.variants[0].id);
    const res = await request(app)
      .post(api(`/products/${product.id}/reviews`))
      .set(customer.authHeader)
      .send({ rating, comment });
    return res.body.data;
  }

  it('ADMIN/STAFF xem được danh sách kèm tên sản phẩm; CUSTOMER bị 403', async () => {
    await seedOne();

    const byAdmin = await request(app).get(api('/reviews')).set(admin.authHeader);
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data[0].product).toHaveProperty('name');

    const byStaff = await request(app).get(api('/reviews')).set(staff.authHeader);
    expect(byStaff.status).toBe(200);

    const byCustomer = await request(app).get(api('/reviews')).set(customer.authHeader);
    expect(byCustomer.status).toBe(403);
  });

  it('ADMIN ẩn rồi hiện lại được', async () => {
    const review = await seedOne();

    const hide = await request(app)
      .patch(api(`/reviews/${review.id}/visibility`))
      .set(admin.authHeader)
      .send({ is_hidden: true });
    expect(hide.body.data.is_hidden).toBe(true);

    const show = await request(app)
      .patch(api(`/reviews/${review.id}/visibility`))
      .set(admin.authHeader)
      .send({ is_hidden: false });
    expect(show.body.data.is_hidden).toBe(false);
  });

  it('STAFF không ẩn/xóa được → 403', async () => {
    const review = await seedOne();

    const hide = await request(app)
      .patch(api(`/reviews/${review.id}/visibility`))
      .set(staff.authHeader)
      .send({ is_hidden: true });
    expect(hide.status).toBe(403);

    const remove = await request(app)
      .delete(api(`/reviews/${review.id}`))
      .set(staff.authHeader);
    expect(remove.status).toBe(403);
  });

  it('ADMIN xóa được; xóa rồi khách đánh giá lại được', async () => {
    const review = await seedOne();

    const res = await request(app).delete(api(`/reviews/${review.id}`)).set(admin.authHeader);
    expect(res.status).toBe(200);
    expect(await prisma.review.count()).toBe(0);

    const again = await request(app)
      .post(api(`/products/${review.product_id}/reviews`))
      .set(customer.authHeader)
      .send({ rating: 5, comment: 'Đánh giá lại' });
    expect(again.status).toBe(201);
  });

  it('filter theo is_hidden và product_id', async () => {
    const visible = await seedOne(5, 'Tốt');
    const hidden = await seedOne(1, 'Xấu');
    await request(app)
      .patch(api(`/reviews/${hidden.id}/visibility`))
      .set(admin.authHeader)
      .send({ is_hidden: true });

    const onlyHidden = await request(app)
      .get(api('/reviews?is_hidden=true'))
      .set(admin.authHeader);
    expect(onlyHidden.body.data).toHaveLength(1);
    expect(onlyHidden.body.data[0].id).toBe(hidden.id);

    const byProduct = await request(app)
      .get(api(`/reviews?product_id=${visible.product_id}`))
      .set(admin.authHeader);
    expect(byProduct.body.data).toHaveLength(1);
  });

  it('review không tồn tại → 404', async () => {
    expect(
      (
        await request(app)
          .patch(api('/reviews/999999/visibility'))
          .set(admin.authHeader)
          .send({ is_hidden: true })
      ).status
    ).toBe(404);
    expect((await request(app).delete(api('/reviews/999999')).set(admin.authHeader)).status).toBe(
      404
    );
  });
});
