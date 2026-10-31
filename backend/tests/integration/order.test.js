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

const CHECKOUT_PAYLOAD = {
  receiver_name: 'Nguyễn Văn A',
  receiver_phone: '0901234567',
  shipping_address: '12 Nguyễn Huệ, Quận 1, TP.HCM',
  payment_method: 'COD',
};

async function assertStockMatchesHistory() {
  const rows = await prisma.$queryRaw`
    SELECT v.id FROM product_variants v
    LEFT JOIN inventory_transactions t ON t.variant_id = v.id
    GROUP BY v.id, v.stock_quantity
    HAVING v.stock_quantity <> COALESCE(SUM(t.quantity), 0)
  `;
  expect(rows).toEqual([]);
}

const addToCart = (session, variantId, quantity) =>
  request(app)
    .post(api('/cart/items'))
    .set(session.authHeader)
    .send({ variant_id: variantId, quantity });

/** Tạo sẵn một đơn PENDING để test vòng đời trạng thái. */
async function placeOrder({ stock = 10, quantity = 2, price = 500_000, sku = 'ORD-100' } = {}) {
  const product = await createProduct({
    name: 'Sản phẩm đặt hàng',
    variants: [{ sku, volume_ml: 100, price, stock }],
  });
  await addToCart(customer, product.variants[0].id, quantity);

  const res = await request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT_PAYLOAD);
  return { product, variantId: product.variants[0].id, res, order: res.body.data };
}

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
});

describe('TC06 — checkout hợp lệ tạo đơn', () => {
  it('tạo đơn PENDING, snapshot giá, sinh mã đơn, xóa giỏ', async () => {
    const { res, variantId } = await placeOrder({ stock: 10, quantity: 2, price: 500_000 });

    expect(res.status).toBe(201);
    const order = res.body.data;

    expect(order.status).toBe('PENDING');
    expect(order.order_code).toMatch(/^PS\d{8}-\d{5}$/);
    expect(order.details).toHaveLength(1);
    expect(order.details[0]).toMatchObject({
      sku: 'ORD-100',
      quantity: 2,
      product_name: 'Sản phẩm đặt hàng',
      volume_ml: 100,
    });
    expect(Number(order.details[0].unit_price)).toBe(500_000);
    expect(Number(order.details[0].line_total)).toBe(1_000_000);

    expect(Number(order.subtotal)).toBe(1_000_000);
    expect(Number(order.shipping_fee)).toBe(30_000);
    expect(Number(order.total_amount)).toBe(1_030_000);

    expect(order.payment).toMatchObject({ method: 'COD', status: 'UNPAID' });
    expect(Number(order.payment.amount)).toBe(1_030_000);
    expect(order.customer.full_name).toBeTruthy();

    // Giỏ hàng phải trống sau khi đặt.
    const cart = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(cart.body.data.items).toHaveLength(0);

    expect(variantId).toBeTruthy();
  });

  it('TC07 — sau checkout: kho giảm đúng và có transaction SALE tham chiếu đơn', async () => {
    const { variantId, order } = await placeOrder({ stock: 10, quantity: 3 });

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(7);

    const sale = await prisma.inventoryTransaction.findFirst({
      where: { variant_id: variantId, type: 'SALE' },
    });
    expect(sale).toMatchObject({
      quantity: -3,
      stock_before: 10,
      stock_after: 7,
      reference: `ORDER:${order.id}`,
    });

    await assertStockMatchesHistory();
  });

  it('giá snapshot không đổi khi giá sản phẩm thay đổi sau đó', async () => {
    const { variantId, order } = await placeOrder({ price: 500_000, quantity: 1 });

    await prisma.productVariant.update({
      where: { id: variantId },
      data: { price: 9_000_000, sale_price: 8_000_000 },
    });

    const res = await request(app).get(api(`/orders/${order.id}`)).set(customer.authHeader);
    expect(Number(res.body.data.details[0].unit_price)).toBe(500_000);
    expect(Number(res.body.data.total_amount)).toBe(530_000);
  });

  it('giỏ rỗng → 409, không tạo đơn', async () => {
    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send(CHECKOUT_PAYLOAD);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Cart is empty');
    expect(await prisma.order.count()).toBe(0);
  });

  it('thiếu thông tin người nhận → 400', async () => {
    const product = await createProduct({
      variants: [{ sku: 'NOINFO-100', volume_ml: 100, price: 100_000, stock: 5 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ payment_method: 'COD' });

    expect(res.status).toBe(400);
    const fields = res.body.errors.map((e) => e.field);
    expect(fields).toContain('receiver_name');
    expect(fields).toContain('shipping_address');
  });

  it('ADMIN không đặt hàng được → 403', async () => {
    const res = await request(app).post(api('/orders')).set(admin.authHeader).send(CHECKOUT_PAYLOAD);
    expect(res.status).toBe(403);
  });
});

describe('TC05 — checkout khi hết hàng', () => {
  it('kho bị xuất hết sau khi thêm giỏ → 422, KHÔNG tạo đơn, kho nguyên vẹn', async () => {
    const product = await createProduct({
      variants: [{ sku: 'TC05-100', volume_ml: 100, price: 500_000, stock: 5 }],
    });
    const variantId = product.variants[0].id;
    await addToCart(customer, variantId, 3);

    // Nhân viên xuất hết kho trước khi khách bấm đặt hàng.
    await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: variantId, quantity: 5 }] });

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send(CHECKOUT_PAYLOAD);

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('Insufficient stock');
    expect(res.body.message).toContain('TC05-100');

    // Rollback toàn bộ: không đơn, không chi tiết, kho vẫn 0, giỏ còn nguyên.
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderDetail.count()).toBe(0);
    expect(await prisma.payment.count()).toBe(0);

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(0);

    const cart = await request(app).get(api('/cart')).set(customer.authHeader);
    expect(cart.body.data.items).toHaveLength(1);

    await assertStockMatchesHistory();
  });

  it('giỏ nhiều dòng, một dòng thiếu hàng → cả đơn bị từ chối', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'MULTI-30', volume_ml: 30, price: 200_000, stock: 10 },
        { sku: 'MULTI-100', volume_ml: 100, price: 500_000, stock: 2 },
      ],
    });
    await addToCart(customer, product.variants[0].id, 2);
    await addToCart(customer, product.variants[1].id, 2);

    await request(app)
      .post(api('/inventory/export'))
      .set(admin.authHeader)
      .send({ items: [{ variant_id: product.variants[1].id, quantity: 2 }] });

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send(CHECKOUT_PAYLOAD);

    expect(res.status).toBe(422);
    expect(await prisma.order.count()).toBe(0);

    // Dòng đầu KHÔNG bị trừ kho dù hợp lệ.
    const first = await prisma.productVariant.findUnique({ where: { id: product.variants[0].id } });
    expect(first.stock_quantity).toBe(10);
    await assertStockMatchesHistory();
  });

  it('sản phẩm bị ẩn sau khi thêm giỏ → 422', async () => {
    const product = await createProduct({
      variants: [{ sku: 'HID-100', volume_ml: 100, price: 500_000, stock: 5 }],
    });
    await addToCart(customer, product.variants[0].id, 1);
    await prisma.product.update({ where: { id: product.id }, data: { status: 'INACTIVE' } });

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send(CHECKOUT_PAYLOAD);

    expect(res.status).toBe(422);
    expect(await prisma.order.count()).toBe(0);
  });

  it('hai khách cùng đặt variant chỉ còn 1: đúng một đơn thành công', async () => {
    const product = await createProduct({
      variants: [{ sku: 'RACE-100', volume_ml: 100, price: 500_000, stock: 1 }],
    });
    const variantId = product.variants[0].id;

    const second = await loginAs('CUSTOMER', { email: 'second@test.local' });
    await addToCart(customer, variantId, 1);
    await addToCart(second, variantId, 1);

    const [a, b] = await Promise.all([
      request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT_PAYLOAD),
      request(app).post(api('/orders')).set(second.authHeader).send(CHECKOUT_PAYLOAD),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 422]);
    expect(await prisma.order.count()).toBe(1);

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(0);
    await assertStockMatchesHistory();
  });

  it('cùng một giỏ checkout 2 lần đồng thời: đúng một đơn, kho trừ một lần, một bộ SALE', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'DBL-30', volume_ml: 30, price: 300_000, stock: 10 },
        { sku: 'DBL-100', volume_ml: 100, price: 900_000, stock: 10 },
      ],
    });
    const bySku = Object.fromEntries(product.variants.map((v) => [v.sku, v.id]));
    // Thêm variant id lớn trước để thứ tự dòng giỏ khác thứ tự id variant.
    await addToCart(customer, bySku['DBL-100'], 2);
    await addToCart(customer, bySku['DBL-30'], 1);

    const [a, b] = await Promise.all([
      request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT_PAYLOAD),
      request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT_PAYLOAD),
    ]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    const winner = a.status === 201 ? a : b;
    expect(loser.body.message).toBe('Cart is empty');

    expect(await prisma.order.count()).toBe(1);
    const stocks = await prisma.productVariant.findMany({
      where: { product_id: product.id },
      select: { sku: true, stock_quantity: true },
    });
    expect(Object.fromEntries(stocks.map((v) => [v.sku, v.stock_quantity]))).toEqual({
      'DBL-30': 9,
      'DBL-100': 8,
    });

    const sales = await prisma.inventoryTransaction.findMany({ where: { type: 'SALE' } });
    expect(sales).toHaveLength(2);
    expect(sales.every((t) => t.reference === `ORDER:${winner.body.data.id}`)).toBe(true);
    await assertStockMatchesHistory();
  });

  it('sửa giỏ trong lúc checkout chờ khóa giỏ: không lỗi, không mất dữ liệu', async () => {
    const product = await createProduct({
      variants: [
        { sku: 'EDIT-30', volume_ml: 30, price: 300_000, stock: 10 },
        { sku: 'EDIT-50', volume_ml: 50, price: 500_000, stock: 10 },
      ],
    });
    const bySku = Object.fromEntries(product.variants.map((v) => [v.sku, v.id]));
    await addToCart(customer, bySku['EDIT-30'], 1);

    const [checkout, add] = await Promise.all([
      request(app).post(api('/orders')).set(customer.authHeader).send(CHECKOUT_PAYLOAD),
      addToCart(customer, bySku['EDIT-50'], 1),
    ]);

    expect(checkout.status).toBe(201);
    expect(add.status).toBe(200);

    // Hai thao tác xếp hàng trên khóa giỏ: EDIT-50 hoặc nằm trong đơn, hoặc còn lại
    // trong giỏ — không bao giờ bị mất, không bao giờ có ở cả hai nơi.
    const orderedSkus = checkout.body.data.details.map((d) => d.sku);
    const cart = await request(app).get(api('/cart')).set(customer.authHeader);
    const cartSkus = cart.body.data.items.map((i) => i.sku);
    expect(orderedSkus).toContain('EDIT-30');
    expect([...orderedSkus, ...cartSkus].sort()).toEqual(['EDIT-30', 'EDIT-50']);
    await assertStockMatchesHistory();
  });
});

describe('TC08 — chuyển trạng thái đơn hàng', () => {
  it('chuyển sai thứ tự PENDING → SHIPPING bị từ chối 409, trạng thái không đổi', async () => {
    const { order } = await placeOrder();

    const res = await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'SHIPPING' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Invalid status transition PENDING → SHIPPING');

    const fresh = await prisma.order.findUnique({ where: { id: order.id } });
    expect(fresh.status).toBe('PENDING');
  });

  it('đi đúng vòng đời PENDING → CONFIRMED → PACKING → SHIPPING → COMPLETED', async () => {
    const { order } = await placeOrder();

    for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED']) {
      const res = await request(app)
        .patch(api(`/orders/${order.id}/status`))
        .set(admin.authHeader)
        .send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }

    const fresh = await prisma.order.findUnique({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(fresh.confirmed_at).not.toBeNull();
    expect(fresh.completed_at).not.toBeNull();
    // COD: hoàn thành đơn đồng nghĩa đã thu tiền.
    expect(fresh.payment.status).toBe('PAID');
  });

  it('mọi chuyển đổi không có trong bảng đều bị chặn', async () => {
    const { order } = await placeOrder();
    const invalid = ['PACKING', 'COMPLETED', 'RETURNED'];

    for (const status of invalid) {
      const res = await request(app)
        .patch(api(`/orders/${order.id}/status`))
        .set(admin.authHeader)
        .send({ status });
      expect(res.status).toBe(409);
    }
  });

  it('đơn đã hủy là trạng thái cuối, không đi tiếp được', async () => {
    const { order } = await placeOrder();
    await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(admin.authHeader)
      .send({ reason: 'Khách đổi ý' });

    const res = await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(409);
  });

  it('DTO trả allowed_transitions khớp bảng chuyển trạng thái', async () => {
    const { order } = await placeOrder();
    expect(order.allowed_transitions.sort()).toEqual(['CANCELLED', 'CONFIRMED']);

    const confirmed = await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'CONFIRMED' });
    expect(confirmed.body.data.allowed_transitions.sort()).toEqual(['CANCELLED', 'PACKING']);
  });

  it('STAFF cập nhật được trạng thái; CUSTOMER thì 403', async () => {
    const { order } = await placeOrder();

    const byStaff = await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(staff.authHeader)
      .send({ status: 'CONFIRMED' });
    expect(byStaff.status).toBe(200);

    const byCustomer = await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(customer.authHeader)
      .send({ status: 'PACKING' });
    expect(byCustomer.status).toBe(403);
  });
});

describe('Hủy đơn', () => {
  it('khách hủy đơn PENDING → kho được cộng lại và ghi transaction RETURN', async () => {
    const { order, variantId } = await placeOrder({ stock: 10, quantity: 3 });

    const beforeCancel = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(beforeCancel.stock_quantity).toBe(7);

    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(customer.authHeader)
      .send({ reason: 'Đặt nhầm dung tích' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.cancelled_reason).toBe('Đặt nhầm dung tích');

    const afterCancel = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(afterCancel.stock_quantity).toBe(10);

    const returnTxn = await prisma.inventoryTransaction.findFirst({
      where: { variant_id: variantId, type: 'RETURN' },
    });
    expect(returnTxn).toMatchObject({ quantity: 3, stock_before: 7, stock_after: 10 });

    await assertStockMatchesHistory();
  });

  it('khách KHÔNG hủy được đơn đã xác nhận → 409', async () => {
    const { order } = await placeOrder();
    await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'CONFIRMED' });

    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(customer.authHeader)
      .send({ reason: 'Muốn hủy' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Cannot cancel order in status CONFIRMED');
  });

  it('admin hủy được đơn CONFIRMED', async () => {
    const { order } = await placeOrder();
    await request(app)
      .patch(api(`/orders/${order.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'CONFIRMED' });

    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(admin.authHeader)
      .send({ reason: 'Hết hàng tại kho' });

    expect(res.status).toBe(200);
    await assertStockMatchesHistory();
  });

  it('không hủy được đơn đang giao → 409', async () => {
    const { order } = await placeOrder();
    for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING']) {
      await request(app)
        .patch(api(`/orders/${order.id}/status`))
        .set(admin.authHeader)
        .send({ status });
    }

    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(admin.authHeader)
      .send({ reason: 'Thử hủy' });

    expect(res.status).toBe(409);
  });

  it('thiếu lý do hủy → 400', async () => {
    const { order } = await placeOrder();
    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(customer.authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('khách không hủy được đơn của người khác → 403', async () => {
    const { order } = await placeOrder();
    const intruder = await loginAs('CUSTOMER', { email: 'intruder2@test.local' });

    const res = await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(intruder.authHeader)
      .send({ reason: 'Tôi muốn hủy đơn người khác' });

    expect(res.status).toBe(403);
  });
});

describe('Trả hàng', () => {
  it('đơn COMPLETED → RETURNED: cộng lại kho và tính lại tổng chi tiêu', async () => {
    const { order, variantId } = await placeOrder({ stock: 10, quantity: 2, price: 500_000 });

    for (const status of ['CONFIRMED', 'PACKING', 'SHIPPING', 'COMPLETED']) {
      await request(app)
        .patch(api(`/orders/${order.id}/status`))
        .set(admin.authHeader)
        .send({ status });
    }

    const afterComplete = await prisma.customer.findUnique({ where: { id: customer.customer.id } });
    expect(afterComplete.total_orders).toBe(1);
    expect(Number(afterComplete.total_spending)).toBe(1_030_000);

    const res = await request(app)
      .patch(api(`/orders/${order.id}/return`))
      .set(admin.authHeader)
      .send({ reason: 'Khách trả vì không đúng mùi' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('RETURNED');

    const variant = await prisma.productVariant.findUnique({ where: { id: variantId } });
    expect(variant.stock_quantity).toBe(10);

    // Trả hàng thì không còn tính vào tổng chi tiêu.
    const afterReturn = await prisma.customer.findUnique({ where: { id: customer.customer.id } });
    expect(afterReturn.total_orders).toBe(0);
    expect(Number(afterReturn.total_spending)).toBe(0);

    await assertStockMatchesHistory();
  });

  it('chỉ trả được đơn đã hoàn thành', async () => {
    const { order } = await placeOrder();
    const res = await request(app)
      .patch(api(`/orders/${order.id}/return`))
      .set(admin.authHeader)
      .send({ reason: 'Thử trả đơn chưa hoàn thành' });
    expect(res.status).toBe(409);
  });

  it('STAFF không xử lý trả hàng được → 403', async () => {
    const { order } = await placeOrder();
    const res = await request(app)
      .patch(api(`/orders/${order.id}/return`))
      .set(staff.authHeader)
      .send({ reason: 'Staff thử' });
    expect(res.status).toBe(403);
  });
});

describe('Xem đơn hàng', () => {
  it('khách chỉ thấy đơn của mình ở /orders/my', async () => {
    await placeOrder({ sku: 'MINE-100' });
    const other = await loginAs('CUSTOMER', { email: 'other@test.local' });

    const mine = await request(app).get(api('/orders/my')).set(customer.authHeader);
    expect(mine.body.meta.total).toBe(1);

    const theirs = await request(app).get(api('/orders/my')).set(other.authHeader);
    expect(theirs.body.meta.total).toBe(0);
  });

  it('khách xem đơn người khác → 403', async () => {
    const { order } = await placeOrder();
    const other = await loginAs('CUSTOMER', { email: 'other2@test.local' });

    const res = await request(app).get(api(`/orders/${order.id}`)).set(other.authHeader);
    expect(res.status).toBe(403);
  });

  it('admin xem được mọi đơn và filter theo trạng thái, tìm theo mã đơn', async () => {
    const { order } = await placeOrder({ sku: 'ADM-100' });

    const all = await request(app).get(api('/orders')).set(admin.authHeader);
    expect(all.body.meta.total).toBe(1);

    const byStatus = await request(app).get(api('/orders?status=PENDING')).set(admin.authHeader);
    expect(byStatus.body.meta.total).toBe(1);

    const byCode = await request(app)
      .get(api(`/orders?q=${order.order_code}`))
      .set(admin.authHeader);
    expect(byCode.body.data[0].order_code).toBe(order.order_code);

    const empty = await request(app).get(api('/orders?status=COMPLETED')).set(admin.authHeader);
    expect(empty.body.meta.total).toBe(0);
  });

  it('CUSTOMER gọi GET /orders (danh sách admin) → 403', async () => {
    const res = await request(app).get(api('/orders')).set(customer.authHeader);
    expect(res.status).toBe(403);
  });

  it('hóa đơn trả đủ dữ liệu để in', async () => {
    const { order } = await placeOrder();
    const res = await request(app).get(api(`/orders/${order.id}/invoice`)).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.order_code).toBe(order.order_code);
    expect(res.body.data.details).toHaveLength(1);
    expect(res.body.data.printed_at).toBeTruthy();
  });
});

describe('Thanh toán', () => {
  it('admin đánh dấu đã thanh toán', async () => {
    const { order } = await placeOrder();

    const res = await request(app)
      .patch(api(`/orders/${order.id}/payment`))
      .set(admin.authHeader)
      .send({ status: 'PAID' });

    expect(res.status).toBe(200);
    expect(res.body.data.payment.status).toBe('PAID');
    expect(res.body.data.payment.paid_at).toBeTruthy();
  });

  it('hủy đơn đã thu tiền → chuyển sang REFUNDED', async () => {
    const { order } = await placeOrder();
    await request(app)
      .patch(api(`/orders/${order.id}/payment`))
      .set(admin.authHeader)
      .send({ status: 'PAID' });

    await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(admin.authHeader)
      .send({ reason: 'Hủy sau khi đã thu' });

    const payment = await prisma.payment.findUnique({ where: { order_id: order.id } });
    expect(payment.status).toBe('REFUNDED');
  });

  it('hủy đơn CHƯA thu tiền thì giữ UNPAID, không ghi hoàn tiền sai sổ', async () => {
    const { order } = await placeOrder();
    await request(app)
      .patch(api(`/orders/${order.id}/cancel`))
      .set(admin.authHeader)
      .send({ reason: 'Hủy khi chưa thu tiền' });

    const payment = await prisma.payment.findUnique({ where: { order_id: order.id } });
    expect(payment.status).toBe('UNPAID');
  });
});

describe('Checkout có mã khuyến mãi', () => {
  async function createPromotion(overrides = {}) {
    return prisma.promotion.create({
      data: {
        code: 'ORDER10',
        name: 'Giảm 10%',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        minimum_order_value: 0,
        max_discount: null,
        usage_limit: 2,
        per_customer_limit: 1,
        start_date: new Date(Date.now() - 86_400_000),
        end_date: new Date(Date.now() + 86_400_000),
        ...overrides,
      },
    });
  }

  it('áp mã: trừ tiền, snapshot mã vào đơn, tăng used_count và ghi usage', async () => {
    const promotion = await createPromotion();
    const product = await createProduct({
      variants: [{ sku: 'PROMO-100', volume_ml: 100, price: 1_000_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'ORDER10' });

    expect(res.status).toBe(201);
    expect(res.body.data.promotion_code).toBe('ORDER10');
    expect(Number(res.body.data.discount_amount)).toBe(100_000);
    expect(Number(res.body.data.total_amount)).toBe(1_000_000 - 100_000 + 30_000);

    const fresh = await prisma.promotion.findUnique({ where: { id: promotion.id } });
    expect(fresh.used_count).toBe(1);

    const usage = await prisma.promotionUsage.findFirst({ where: { promotion_id: promotion.id } });
    expect(Number(usage.discount_amount)).toBe(100_000);
  });

  it('khách dùng lại mã đã dùng → 422 và không tạo đơn', async () => {
    await createPromotion();
    const product = await createProduct({
      variants: [{ sku: 'REUSE-100', volume_ml: 100, price: 1_000_000, stock: 10 }],
    });

    await addToCart(customer, product.variants[0].id, 1);
    await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'ORDER10' });

    await addToCart(customer, product.variants[0].id, 1);
    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'ORDER10' });

    expect(res.status).toBe(422);
    expect(res.body.message).toContain('already used');
    expect(await prisma.order.count()).toBe(1);
  });

  it('mã hết hạn → 422', async () => {
    await createPromotion({
      code: 'EXPIRED',
      start_date: new Date(Date.now() - 172_800_000),
      end_date: new Date(Date.now() - 86_400_000),
    });
    const product = await createProduct({
      variants: [{ sku: 'EXPCODE-100', volume_ml: 100, price: 1_000_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    const res = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'EXPIRED' });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('Promotion has expired');
  });

  it('hủy đơn có mã → nhả lại lượt dùng để khách dùng cho đơn khác', async () => {
    const promotion = await createPromotion();
    const product = await createProduct({
      variants: [{ sku: 'RELEASE-100', volume_ml: 100, price: 1_000_000, stock: 10 }],
    });
    await addToCart(customer, product.variants[0].id, 1);

    const created = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'ORDER10' });

    await request(app)
      .patch(api(`/orders/${created.body.data.id}/cancel`))
      .set(customer.authHeader)
      .send({ reason: 'Hủy để dùng mã lại' });

    const fresh = await prisma.promotion.findUnique({ where: { id: promotion.id } });
    expect(fresh.used_count).toBe(0);
    expect(await prisma.promotionUsage.count({ where: { promotion_id: promotion.id } })).toBe(0);

    // Dùng lại được sau khi hủy.
    await addToCart(customer, product.variants[0].id, 1);
    const second = await request(app)
      .post(api('/orders'))
      .set(customer.authHeader)
      .send({ ...CHECKOUT_PAYLOAD, promotion_code: 'ORDER10' });
    expect(second.status).toBe(201);
  });

  it('POST /promotions/validate trả tiền giảm cho khách', async () => {
    await createPromotion();
    const res = await request(app)
      .post(api('/promotions/validate'))
      .set(customer.authHeader)
      .send({ code: 'ORDER10', subtotal: 2_000_000 });

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(Number(res.body.data.discount_amount)).toBe(200_000);
  });
});

describe('Đồng thời: hủy đơn và checkout dùng chung promotion + variant', () => {
  it('không deadlock / 500: thứ tự khóa chung cart → promotion → variants (id tăng dần)', async () => {
    const promotion = await prisma.promotion.create({
      data: {
        code: 'LOCKORDER',
        name: 'Thứ tự khóa',
        discount_type: 'FIXED',
        discount_value: 50_000,
        start_date: new Date(Date.now() - 86_400_000),
        end_date: new Date(Date.now() + 86_400_000),
        usage_limit: 100,
        per_customer_limit: 1,
      },
    });
    const product = await createProduct({
      variants: [
        { sku: 'LOCK-30', volume_ml: 30, price: 300_000, stock: 50 },
        { sku: 'LOCK-100', volume_ml: 100, price: 900_000, stock: 50 },
      ],
    });
    const [low, high] = product.variants.map((v) => v.id).sort((a, b) => a - b);
    const withCode = { ...CHECKOUT_PAYLOAD, promotion_code: promotion.code };

    const ROUNDS = 4;
    for (let round = 0; round < ROUNDS; round += 1) {
      const buyer = await loginAs('CUSTOMER', { email: `lock-a-${round}@test.local` });
      const racer = await loginAs('CUSTOMER', { email: `lock-b-${round}@test.local` });

      // Đơn sẽ bị hủy: dòng giỏ theo id tăng dần.
      await addToCart(buyer, low, 1);
      await addToCart(buyer, high, 1);
      const placed = await request(app).post(api('/orders')).set(buyer.authHeader).send(withCode);
      expect(placed.status).toBe(201);

      // Giỏ của người checkout song song: thứ tự dòng ngược lại.
      await addToCart(racer, high, 1);
      await addToCart(racer, low, 1);

      const [cancel, checkout] = await Promise.all([
        request(app)
          .patch(api(`/orders/${placed.body.data.id}/cancel`))
          .set(buyer.authHeader)
          .send({ reason: 'test đồng thời' }),
        request(app).post(api('/orders')).set(racer.authHeader).send(withCode),
      ]);

      expect({ round, cancel: cancel.status, checkout: checkout.status }).toEqual({
        round,
        cancel: 200,
        checkout: 201,
      });
    }

    // Mỗi vòng: một đơn bị hủy (nhả lượt + hoàn kho), một đơn còn hiệu lực.
    const fresh = await prisma.promotion.findUnique({ where: { id: promotion.id } });
    expect(fresh.used_count).toBe(ROUNDS);
    expect(await prisma.promotionUsage.count({ where: { promotion_id: promotion.id } })).toBe(ROUNDS);

    const stocks = await prisma.productVariant.findMany({ where: { product_id: product.id } });
    for (const variant of stocks) expect(variant.stock_quantity).toBe(50 - ROUNDS);
    await assertStockMatchesHistory();
  });
});
