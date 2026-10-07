'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, createUser, loginAs, TEST_PASSWORD } = require('../helpers/auth');
const { createOrder } = require('../helpers/order');
const customerService = require('../../src/modules/customers/customer.service');

const api = (path) => `/api/v1${path}`;

let admin;
let staff;

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
  admin = await loginAs('ADMIN');
  staff = await loginAs('STAFF');
});

describe('Phân quyền module khách hàng', () => {
  it('CUSTOMER không xem được danh sách khách → 403', async () => {
    const customer = await loginAs('CUSTOMER');
    const res = await request(app).get(api('/customers')).set(customer.authHeader);
    expect(res.status).toBe(403);
  });

  it('STAFF xem được danh sách nhưng không khóa được khách', async () => {
    const { customer } = await createUser({ email: 'target@test.local' });

    const listRes = await request(app).get(api('/customers')).set(staff.authHeader);
    expect(listRes.status).toBe(200);

    const lockRes = await request(app)
      .patch(api(`/customers/${customer.id}/status`))
      .set(staff.authHeader)
      .send({ status: 'LOCKED' });
    expect(lockRes.status).toBe(403);
  });
});

describe('GET /customers', () => {
  beforeEach(async () => {
    await createUser({ email: 'an@test.local', full_name: 'An Nguyễn' });
    await createUser({ email: 'binh@test.local', full_name: 'Bình Lê' });
    await createUser({ email: 'cuong@test.local', full_name: 'Cường Trần', status: 'LOCKED' });
  });

  it('trả CustomerDTO phẳng gồm thông tin user, không lộ password', async () => {
    const res = await request(app).get(api('/customers')).set(admin.authHeader);

    expect(res.status).toBe(200);
    const row = res.body.data[0];
    expect(row).toHaveProperty('full_name');
    expect(row).toHaveProperty('email');
    expect(row).toHaveProperty('status');
    expect(row).toHaveProperty('total_orders');
    expect(row).toHaveProperty('total_spending');
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('chỉ đếm khách hàng, không gồm tài khoản admin/staff', async () => {
    const res = await request(app).get(api('/customers')).set(admin.authHeader);
    // 3 khách tạo ở beforeEach + 1 khách từ loginAs ở suite khác không có → đúng 3.
    expect(res.body.meta.total).toBe(3);
  });

  it('tìm theo tên, email, số điện thoại', async () => {
    const byName = await request(app).get(api('/customers?q=Bình')).set(admin.authHeader);
    expect(byName.body.data.map((c) => c.email)).toEqual(['binh@test.local']);

    const byEmail = await request(app).get(api('/customers?q=an@test')).set(admin.authHeader);
    expect(byEmail.body.data).toHaveLength(1);
  });

  it('filter theo status', async () => {
    const res = await request(app).get(api('/customers?status=LOCKED')).set(admin.authHeader);
    expect(res.body.data.map((c) => c.full_name)).toEqual(['Cường Trần']);
  });

  it('sắp xếp theo total_spending giảm dần', async () => {
    const customers = await prisma.customer.findMany({ include: { user: true } });
    const an = customers.find((c) => c.user.email === 'an@test.local');
    const binh = customers.find((c) => c.user.email === 'binh@test.local');

    await createOrder({ customerId: an.id, totalAmount: 5_000_000 });
    await createOrder({ customerId: binh.id, totalAmount: 9_000_000 });
    await customerService.recalculateTotals(an.id);
    await customerService.recalculateTotals(binh.id);

    const res = await request(app)
      .get(api('/customers?sort=total_spending:desc'))
      .set(admin.authHeader);

    expect(res.body.data[0].email).toBe('binh@test.local');
    expect(Number(res.body.data[0].total_spending)).toBe(9_000_000);
  });

  it('khách bị xóa mềm không còn trong danh sách', async () => {
    const { user } = await createUser({ email: 'deleted@test.local' });
    await prisma.user.update({ where: { id: user.id }, data: { deleted_at: new Date() } });

    const res = await request(app).get(api('/customers')).set(admin.authHeader);
    expect(res.body.data.some((c) => c.email === 'deleted@test.local')).toBe(false);
  });

  it('pagination trả meta đúng', async () => {
    const res = await request(app).get(api('/customers?limit=2')).set(admin.authHeader);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('GET /customers/:id', () => {
  it('trả chi tiết kèm đơn gần đây và thống kê theo trạng thái', async () => {
    const { customer } = await createUser({ email: 'detail@test.local', full_name: 'Chi Tiết' });

    await createOrder({ customerId: customer.id, status: 'COMPLETED', totalAmount: 2_000_000 });
    await createOrder({ customerId: customer.id, status: 'PENDING', totalAmount: 500_000 });
    await createOrder({ customerId: customer.id, status: 'CANCELLED', totalAmount: 300_000 });

    const res = await request(app).get(api(`/customers/${customer.id}`)).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Chi Tiết');
    expect(res.body.data.recent_orders).toHaveLength(3);
    expect(res.body.data.recent_orders[0]).toHaveProperty('order_code');
    expect(res.body.data.recent_orders[0]).toHaveProperty('item_count');

    const counts = Object.fromEntries(
      res.body.data.order_status_counts.map((row) => [row.status, row.count])
    );
    expect(counts).toEqual({ COMPLETED: 1, PENDING: 1, CANCELLED: 1 });
  });

  it('khách không tồn tại → 404', async () => {
    const res = await request(app).get(api('/customers/999999')).set(admin.authHeader);
    expect(res.status).toBe(404);
  });

  it('id không phải số → 400', async () => {
    const res = await request(app).get(api('/customers/abc')).set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('GET /customers/:id/orders', () => {
  it('phân trang và lọc theo trạng thái', async () => {
    const { customer } = await createUser({ email: 'orders@test.local' });

    await createOrder({ customerId: customer.id, status: 'COMPLETED' });
    await createOrder({ customerId: customer.id, status: 'COMPLETED' });
    await createOrder({ customerId: customer.id, status: 'PENDING' });

    const all = await request(app)
      .get(api(`/customers/${customer.id}/orders`))
      .set(admin.authHeader);
    expect(all.body.meta.total).toBe(3);

    const completed = await request(app)
      .get(api(`/customers/${customer.id}/orders?status=COMPLETED`))
      .set(admin.authHeader);
    expect(completed.body.meta.total).toBe(2);
  });

  it('status không hợp lệ → 400', async () => {
    const { customer } = await createUser({ email: 'badstatus@test.local' });
    const res = await request(app)
      .get(api(`/customers/${customer.id}/orders?status=KHONG_CO`))
      .set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('PATCH /customers/:id/status', () => {
  it('khóa khách → thu hồi session và chặn đăng nhập lại', async () => {
    const victim = await loginAs('CUSTOMER', { email: 'lockme@test.local' });

    const res = await request(app)
      .patch(api(`/customers/${victim.customer.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'LOCKED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOCKED');

    const meRes = await request(app).get(api('/auth/me')).set(victim.authHeader);
    expect(meRes.status).toBe(403);

    const refreshRes = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: victim.refreshToken });
    expect(refreshRes.status).toBe(401);

    const loginRes = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'lockme@test.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(403);
  });

  it('mở khóa lại thì đăng nhập được', async () => {
    const { customer } = await createUser({ email: 'unlockme@test.local', status: 'LOCKED' });

    await request(app)
      .patch(api(`/customers/${customer.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'ACTIVE' });

    const loginRes = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'unlockme@test.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(200);
  });
});

describe('recalculateTotals', () => {
  it('chỉ tính đơn COMPLETED, bỏ qua đơn khác', async () => {
    const { customer } = await createUser({ email: 'totals@test.local' });

    await createOrder({ customerId: customer.id, status: 'COMPLETED', totalAmount: 1_000_000 });
    await createOrder({ customerId: customer.id, status: 'COMPLETED', totalAmount: 2_500_000 });
    await createOrder({ customerId: customer.id, status: 'PENDING', totalAmount: 9_000_000 });
    await createOrder({ customerId: customer.id, status: 'CANCELLED', totalAmount: 7_000_000 });
    await createOrder({ customerId: customer.id, status: 'RETURNED', totalAmount: 4_000_000 });

    await customerService.recalculateTotals(customer.id);

    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated.total_orders).toBe(2);
    expect(Number(updated.total_spending)).toBe(3_500_000);
  });

  it('khách chưa có đơn COMPLETED → về 0', async () => {
    const { customer } = await createUser({ email: 'zero@test.local' });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { total_orders: 9, total_spending: 999 },
    });

    await createOrder({ customerId: customer.id, status: 'PENDING', totalAmount: 1_000_000 });
    await customerService.recalculateTotals(customer.id);

    const updated = await prisma.customer.findUnique({ where: { id: customer.id } });
    expect(updated.total_orders).toBe(0);
    expect(Number(updated.total_spending)).toBe(0);
  });
});
