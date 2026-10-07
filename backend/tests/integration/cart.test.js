'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs } = require('../helpers/auth');
const { createProduct } = require('../helpers/catalog');

const api = (path) => `/api/v1${path}`;

let customer;

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  customer = await loginAs('CUSTOMER');
});

const addToCart = (session, variantId, quantity) =>
  request(app)
    .post(api('/cart/items'))
    .set(session.authHeader)
    .send({ variant_id: variantId, quantity });

describe('GET /cart', () => {
  it('khách mới có giỏ rỗng với đủ field tính tiền', async () => {
    const res = await request(app).get(api('/cart')).set(customer.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ items: [], item_count: 0, total_quantity: 0 });
    expect(Number(res.body.data.subtotal)).toBe(0);
  });

  it('ADMIN không có giỏ hàng → 403', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/cart')).set(admin.authHeader);
    expect(res.status).toBe(403);
  });

  it('không có token → 401', async () => {
    expect((await request(app).get(api('/cart'))).status).toBe(401);
  });
});

describe('POST /cart/items', () => {
  it('thêm sản phẩm, dùng sale_price làm đơn giá', async () => {
    const product = await createProduct({
      name: 'Có giảm giá',
      variants: [
        { sku: 'SALE-100', volume_ml: 100, price: 1_000_000, sale_price: 800_000, stock: 10 },
      ],
    });

    const res = await addToCart(customer, product.variants[0].id, 2);

    expect(res.status).toBe(200);
    const item = res.body.data.items[0];
    expect(Number(item.unit_price)).toBe(800_000);
    expect(Number(item.list_price)).toBe(1_000_000);
    expect(Number(item.line_total)).toBe(1_600_000);
    expect(Number(res.body.data.subtotal)).toBe(1_600_000);
  });

  it('thêm lại cùng variant thì cộng dồn số lượng', async () => {
    const product = await createProduct({
      variants: [{ sku: 'MERGE-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    const variantId = product.variants[0].id;

    await addToCart(customer, variantId, 2);
    const res = await addToCart(customer, variantId, 3);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it('TC04 — quantity vượt tồn kho → 422, giỏ không đổi', async () => {
    const product = await createProduct({
      variants: [{ sku: 'TC04-100', volume_ml: 100, price: 100_000, stock: 5 }],
    });

    const res = await addToCart(customer, product.variants[0].id, 6);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('exceeds available stock');

    const cart = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(cart.body.data.items).toHaveLength(0);
  });

  it('TC04 — cộng dồn vượt tồn kho cũng bị chặn', async () => {
    const product = await createProduct({
      variants: [{ sku: 'TC04B-100', volume_ml: 100, price: 100_000, stock: 5 }],
    });
    const variantId = product.variants[0].id;

    await addToCart(customer, variantId, 4);
    const res = await addToCart(customer, variantId, 2);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('cart already has 4');

    const cart = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(cart.body.data.items[0].quantity).toBe(4);
  });

  it('variant đã ngừng bán → 409', async () => {
    const product = await createProduct({
      variants: [{ sku: 'INACTIVE-100', volume_ml: 100, price: 100_000, stock: 10, status: 'INACTIVE' }],
    });

    const res = await addToCart(customer, product.variants[0].id, 1);
    expect(res.status).toBe(409);
  });

  it('sản phẩm đã xóa mềm → 409', async () => {
    const product = await createProduct({
      variants: [{ sku: 'DELETED-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    await prisma.product.update({ where: { id: product.id }, data: { deleted_at: new Date() } });

    const res = await addToCart(customer, product.variants[0].id, 1);
    expect(res.status).toBe(409);
  });

  it('variant không tồn tại → 404; quantity 0 → 400', async () => {
    expect((await addToCart(customer, 999999, 1)).status).toBe(404);

    const product = await createProduct({
      variants: [{ sku: 'ZEROQTY-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    expect((await addToCart(customer, product.variants[0].id, 0)).status).toBe(400);
  });
});

describe('PUT /cart/items/:itemId', () => {
  it('cập nhật số lượng trong giới hạn tồn kho', async () => {
    const product = await createProduct({
      variants: [{ sku: 'UPD-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    const added = await addToCart(customer, product.variants[0].id, 2);
    const itemId = added.body.data.items[0].id;

    const res = await request(app)
      .put(api(`/cart/items/${itemId}`))
      .set(customer.authHeader)
      .send({ quantity: 7 });

    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(7);
  });

  it('TC04 — cập nhật vượt tồn kho → 422', async () => {
    const product = await createProduct({
      variants: [{ sku: 'UPDOVER-100', volume_ml: 100, price: 100_000, stock: 5 }],
    });
    const added = await addToCart(customer, product.variants[0].id, 2);

    const res = await request(app)
      .put(api(`/cart/items/${added.body.data.items[0].id}`))
      .set(customer.authHeader)
      .send({ quantity: 50 });

    expect(res.status).toBe(422);
  });

  it('sửa dòng trong giỏ của khách khác → 403', async () => {
    const product = await createProduct({
      variants: [{ sku: 'OTHER-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    const added = await addToCart(customer, product.variants[0].id, 1);
    const itemId = added.body.data.items[0].id;

    const intruder = await loginAs('CUSTOMER', { email: 'intruder@test.local' });
    const res = await request(app)
      .put(api(`/cart/items/${itemId}`))
      .set(intruder.authHeader)
      .send({ quantity: 2 });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /cart và /cart/items/:itemId', () => {
  it('xóa một dòng và xóa cả giỏ', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'DEL-30', volume_ml: 30, price: 100_000, stock: 10 },
        { sku: 'DEL-100', volume_ml: 100, price: 200_000, stock: 10 },
      ],
    });

    await addToCart(customer, product.variants[0].id, 1);
    const added = await addToCart(customer, product.variants[1].id, 1);
    const itemId = added.body.data.items[0].id;

    const afterRemove = await request(app)
      .delete(api(`/cart/items/${itemId}`))
      .set(customer.authHeader);
    expect(afterRemove.body.data.items).toHaveLength(1);

    const afterClear = await request(app).delete(api('/cart')).set(customer.authHeader);
    expect(afterClear.body.data.items).toHaveLength(0);
  });
});

describe('Cảnh báo khi tồn kho thay đổi sau khi đã thêm vào giỏ', () => {
  it('kho giảm dưới số lượng trong giỏ → giỏ hiện cảnh báo', async () => {
    const product = await createProduct({
      variants: [{ sku: 'WARN-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    const variantId = product.variants[0].id;
    await addToCart(customer, variantId, 8);

    // Giả lập kho bị xuất bớt sau khi khách đã thêm vào giỏ.
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock_quantity: 3 } });

    const res = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(res.body.data.warnings).toHaveLength(1);
    expect(res.body.data.warnings[0].sku).toBe('WARN-100');
    expect(res.body.data.items[0].issues[0]).toContain('Chỉ còn 3');
  });

  it('sản phẩm bị ẩn sau khi thêm giỏ → cảnh báo không còn bán', async () => {
    const product = await createProduct({
      variants: [{ sku: 'HIDDEN-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);
    await prisma.product.update({ where: { id: product.id }, data: { status: 'INACTIVE' } });

    const res = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(res.body.data.warnings[0].messages[0]).toContain('không còn được bán');
  });
});

describe('POST /cart/preview', () => {
  it('tính subtotal, phí ship và tổng tiền', async () => {
    const product = await createProduct({
      variants: [{ sku: 'PREV-100', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 2);

    const res = await request(app).post(api('/cart/preview')).set(customer.authHeader).send({});

    expect(res.status).toBe(200);
    expect(Number(res.body.data.subtotal)).toBe(1_000_000);
    expect(Number(res.body.data.shipping_fee)).toBe(30_000);
    expect(Number(res.body.data.discount_amount)).toBe(0);
    expect(Number(res.body.data.total_amount)).toBe(1_030_000);
  });

  it('giỏ rỗng → không tính phí ship', async () => {
    const res = await request(app).post(api('/cart/preview')).set(customer.authHeader).send({});
    expect(Number(res.body.data.shipping_fee)).toBe(0);
    expect(Number(res.body.data.total_amount)).toBe(0);
  });

  it('áp mã giảm theo phần trăm, bị chặn bởi max_discount', async () => {
    const product = await createProduct({
      variants: [{ sku: 'PCT-100', volume_ml: 100, price: 5_000_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    await prisma.promotion.create({
      data: {
        code: 'GIAM10',
        name: 'Giảm 10% tối đa 300k',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        minimum_order_value: 0,
        max_discount: 300_000,
        start_date: new Date(Date.now() - 86_400_000),
        end_date: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await request(app)
      .post(api('/cart/preview'))
      .set(customer.authHeader)
      .send({ promotion_code: 'GIAM10' });

    // 10% của 5tr = 500k nhưng bị chặn ở 300k.
    expect(Number(res.body.data.discount_amount)).toBe(300_000);
    expect(Number(res.body.data.total_amount)).toBe(5_000_000 - 300_000 + 30_000);
  });

  it('mã sai → vẫn trả bảng giá kèm lý do, không phải lỗi 4xx', async () => {
    const product = await createProduct({
      variants: [{ sku: 'BADCODE-100', volume_ml: 100, price: 500_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    const res = await request(app)
      .post(api('/cart/preview'))
      .set(customer.authHeader)
      .send({ promotion_code: 'KHONGTONTAI' });

    expect(res.status).toBe(200);
    expect(res.body.data.promotion).toBeNull();
    expect(res.body.data.promotion_error).toBe('Promotion code not found');
    expect(Number(res.body.data.discount_amount)).toBe(0);
  });

  it('đơn chưa đạt giá trị tối thiểu → báo lý do', async () => {
    const product = await createProduct({
      variants: [{ sku: 'MINVAL-100', volume_ml: 100, price: 100_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    await prisma.promotion.create({
      data: {
        code: 'DON3TR',
        name: 'Đơn từ 3 triệu',
        discount_type: 'FIXED',
        discount_value: 200_000,
        minimum_order_value: 3_000_000,
        start_date: new Date(Date.now() - 86_400_000),
        end_date: new Date(Date.now() + 86_400_000),
      },
    });

    const res = await request(app)
      .post(api('/cart/preview'))
      .set(customer.authHeader)
      .send({ promotion_code: 'DON3TR' });

    expect(res.body.data.promotion_error).toContain('minimum value');
  });
});
