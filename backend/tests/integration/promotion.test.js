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

const DAY = 86_400_000;
const future = (days) => new Date(Date.now() + days * DAY).toISOString();
const past = (days) => new Date(Date.now() - days * DAY).toISOString();

const VALID_PAYLOAD = {
  code: 'SALE20',
  name: 'Giảm 20% toàn bộ',
  discount_type: 'PERCENTAGE',
  discount_value: 20,
  minimum_order_value: 500000,
  max_discount: 300000,
  usage_limit: 100,
  per_customer_limit: 1,
};

const payload = (overrides = {}) => ({
  ...VALID_PAYLOAD,
  start_date: past(1),
  end_date: future(30),
  ...overrides,
});

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
  customer = await loginAs('CUSTOMER');
});

describe('Phân quyền module khuyến mãi', () => {
  it('STAFF xem được danh sách nhưng không tạo/sửa/xóa được', async () => {
    const list = await request(app).get(api('/promotions')).set(staff.authHeader);
    expect(list.status).toBe(200);

    const create = await request(app).post(api('/promotions')).set(staff.authHeader).send(payload());
    expect(create.status).toBe(403);
  });

  it('CUSTOMER không xem được danh sách khuyến mãi → 403', async () => {
    const res = await request(app).get(api('/promotions')).set(customer.authHeader);
    expect(res.status).toBe(403);
  });

  it('CUSTOMER vẫn dùng được /promotions/validate', async () => {
    await request(app).post(api('/promotions')).set(admin.authHeader).send(payload());
    const res = await request(app)
      .post(api('/promotions/validate'))
      .set(customer.authHeader)
      .send({ code: 'SALE20', subtotal: 2_000_000 });
    expect(res.status).toBe(200);
  });

  it('ADMIN/STAFF gọi /validate → 403 (chỉ khách dùng mã)', async () => {
    const res = await request(app)
      .post(api('/promotions/validate'))
      .set(admin.authHeader)
      .send({ code: 'SALE20', subtotal: 1000 });
    expect(res.status).toBe(403);
  });
});

describe('POST /promotions', () => {
  it('tạo mã hợp lệ, code tự chuyển in hoa', async () => {
    const res = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'sale20' }));

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('SALE20');
    expect(res.body.data.used_count).toBe(0);
    expect(res.body.data.effective_state).toBe('RUNNING');
  });

  it('code trùng → 409', async () => {
    await request(app).post(api('/promotions')).set(admin.authHeader).send(payload());
    const res = await request(app).post(api('/promotions')).set(admin.authHeader).send(payload());
    expect(res.status).toBe(409);
  });

  it('end_date không sau start_date → 400', async () => {
    const res = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ start_date: future(10), end_date: future(5) }));

    expect(res.status).toBe(400);
    expect(res.body.errors.some((e) => e.field.includes('end_date'))).toBe(true);
  });

  it('PERCENTAGE ngoài khoảng 1-100 → 400', async () => {
    for (const value of [0, 101, 150]) {
      const res = await request(app)
        .post(api('/promotions'))
        .set(admin.authHeader)
        .send(payload({ code: `PCT${value}`, discount_value: value }));
      expect(res.status).toBe(400);
    }
  });

  it('FIXED không cần max_discount, và không được truyền max_discount', async () => {
    const ok = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'FIXED200', discount_type: 'FIXED', discount_value: 200000, max_discount: null }));
    expect(ok.status).toBe(201);

    const bad = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'FIXEDBAD', discount_type: 'FIXED', discount_value: 200000, max_discount: 50000 }));
    expect(bad.status).toBe(400);
    expect(bad.body.errors.some((e) => e.field.includes('max_discount'))).toBe(true);
  });

  it('code chứa ký tự lạ → 400', async () => {
    const res = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'giảm giá!' }));
    expect(res.status).toBe(400);
  });

  it('discount_value âm hoặc 0 → 400', async () => {
    const res = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ discount_value: 0 }));
    expect(res.status).toBe(400);
  });
});

describe('GET /promotions', () => {
  beforeEach(async () => {
    await request(app).post(api('/promotions')).set(admin.authHeader).send(payload({ code: 'RUNNING1' }));
    await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'SCHEDULED1', start_date: future(5), end_date: future(10) }));
    await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'EXPIRED1', start_date: past(10), end_date: past(5) }));
    await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload({ code: 'OFF1', status: 'INACTIVE' }));
  });

  it('trả effective_state suy ra từ ngày và trạng thái', async () => {
    const res = await request(app).get(api('/promotions?limit=50')).set(admin.authHeader);
    const byCode = Object.fromEntries(res.body.data.map((p) => [p.code, p.effective_state]));

    expect(byCode.RUNNING1).toBe('RUNNING');
    expect(byCode.SCHEDULED1).toBe('SCHEDULED');
    expect(byCode.EXPIRED1).toBe('EXPIRED');
    expect(byCode.OFF1).toBe('INACTIVE');
  });

  it('active_only=true chỉ trả mã đang hiệu lực ngay lúc này', async () => {
    const res = await request(app)
      .get(api('/promotions?active_only=true&limit=50'))
      .set(admin.authHeader);
    expect(res.body.data.map((p) => p.code)).toEqual(['RUNNING1']);
  });

  it('filter theo status và tìm theo code/name', async () => {
    const inactive = await request(app)
      .get(api('/promotions?status=INACTIVE'))
      .set(admin.authHeader);
    expect(inactive.body.data.map((p) => p.code)).toEqual(['OFF1']);

    const byCode = await request(app).get(api('/promotions?q=EXPIRED')).set(admin.authHeader);
    expect(byCode.body.data).toHaveLength(1);
  });

  it('pagination trả meta đúng', async () => {
    const res = await request(app).get(api('/promotions?limit=2')).set(admin.authHeader);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });
  });
});

describe('PUT /promotions/:id', () => {
  let promotionId;

  beforeEach(async () => {
    const res = await request(app).post(api('/promotions')).set(admin.authHeader).send(payload());
    promotionId = res.body.data.id;
  });

  it('sửa tên và giá trị giảm', async () => {
    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({ name: 'Tên mới', discount_value: 15 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Tên mới');
    expect(Number(res.body.data.discount_value)).toBe(15);
  });

  it('chỉ đổi end_date nhưng vẫn kiểm tra chéo với start_date đang lưu', async () => {
    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({ end_date: past(5) });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('end_date must be after start_date');
  });

  it('chỉ đổi discount_value nhưng vẫn áp rule của PERCENTAGE đang lưu', async () => {
    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({ discount_value: 150 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('between 1 and 100');
  });

  it('không hạ usage_limit xuống dưới số lượt đã dùng', async () => {
    await prisma.promotion.update({ where: { id: promotionId }, data: { used_count: 5 } });

    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({ usage_limit: 3 });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('used_count (5)');
  });

  it('đổi code sang code đã tồn tại → 409', async () => {
    await request(app).post(api('/promotions')).set(admin.authHeader).send(payload({ code: 'OTHER1' }));

    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({ code: 'OTHER1' });

    expect(res.status).toBe(409);
  });

  it('body rỗng → 400', async () => {
    const res = await request(app)
      .put(api(`/promotions/${promotionId}`))
      .set(admin.authHeader)
      .send({});
    expect(res.status).toBe(400);
  });

  it('id không tồn tại → 404', async () => {
    const res = await request(app)
      .put(api('/promotions/999999'))
      .set(admin.authHeader)
      .send({ name: 'Tên hợp lệ' });
    expect(res.status).toBe(404);
  });

  it('validation chạy TRƯỚC khi tìm bản ghi: body sai + id không tồn tại → 400', async () => {
    // Thứ tự route → validation → controller → service (CLAUDE.md §3),
    // nên lỗi body được báo trước, không cần truy vấn DB.
    const res = await request(app)
      .put(api('/promotions/999999'))
      .set(admin.authHeader)
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /promotions/:id/status', () => {
  it('tắt mã thì khách không dùng được nữa', async () => {
    const created = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload());
    const id = created.body.data.id;

    const before = await request(app)
      .post(api('/promotions/validate'))
      .set(customer.authHeader)
      .send({ code: 'SALE20', subtotal: 2_000_000 });
    expect(before.status).toBe(200);

    await request(app)
      .patch(api(`/promotions/${id}/status`))
      .set(admin.authHeader)
      .send({ status: 'INACTIVE' });

    const after = await request(app)
      .post(api('/promotions/validate'))
      .set(customer.authHeader)
      .send({ code: 'SALE20', subtotal: 2_000_000 });
    expect(after.status).toBe(422);
    expect(after.body.message).toBe('Promotion is not active');
  });
});

describe('DELETE /promotions/:id', () => {
  it('xóa được mã chưa ai dùng', async () => {
    const created = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload());

    const res = await request(app)
      .delete(api(`/promotions/${created.body.data.id}`))
      .set(admin.authHeader);
    expect(res.status).toBe(200);
    expect(await prisma.promotion.count()).toBe(0);
  });

  it('mã đã có đơn dùng → 409, gợi ý tắt thay vì xóa', async () => {
    const created = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload());
    const id = created.body.data.id;

    const product = await createProduct({
      variants: [{ sku: 'PROMODEL-100', volume_ml: 100, price: 1_000_000, stock: 10 }],
    });
    await request(app)
      .post(api('/cart/items'))
      .set(customer.authHeader)
      .send({ variant_id: product.variants[0].id, quantity: 1 });
    await request(app).post(api('/orders')).set(customer.authHeader).send({
      receiver_name: 'Khách Test',
      receiver_phone: '0901234567',
      shipping_address: '1 Lê Lợi, Quận 1',
      payment_method: 'COD',
      promotion_code: 'SALE20',
    });

    const res = await request(app).delete(api(`/promotions/${id}`)).set(admin.authHeader);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Deactivate it instead');
  });
});

describe('GET /promotions/:id', () => {
  it('trả số lượt đã dùng', async () => {
    const created = await request(app)
      .post(api('/promotions'))
      .set(admin.authHeader)
      .send(payload());

    const res = await request(app)
      .get(api(`/promotions/${created.body.data.id}`))
      .set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.usages_count).toBe(0);
    expect(res.body.data).toHaveProperty('created_at');
  });
});
