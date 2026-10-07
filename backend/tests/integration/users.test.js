'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, createUser, login, loginAs, TEST_PASSWORD } = require('../helpers/auth');

const api = (path) => `/api/v1${path}`;

let roles;

beforeEach(async () => {
  await truncateAll();
  ({ roles } = await seedRbac());
});

describe('TC09 — STAFF gọi API quản lý user/role', () => {
  it('GET /roles → 403', async () => {
    const staff = await loginAs('STAFF');
    const res = await request(app).get(api('/roles')).set(staff.authHeader);
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('POST /users → 403', async () => {
    const staff = await loginAs('STAFF');
    const res = await request(app)
      .post(api('/users'))
      .set(staff.authHeader)
      .send({
        email: 'x@test.local',
        password: 'Password123',
        full_name: 'Không được phép',
        role_ids: [roles.STAFF.id],
      });
    expect(res.status).toBe(403);
  });

  it('GET /users và GET /permissions → 403', async () => {
    const staff = await loginAs('STAFF');
    const [users, permissions] = await Promise.all([
      request(app).get(api('/users')).set(staff.authHeader),
      request(app).get(api('/permissions')).set(staff.authHeader),
    ]);
    expect(users.status).toBe(403);
    expect(permissions.status).toBe(403);
  });

  it('CUSTOMER cũng bị 403', async () => {
    const customer = await loginAs('CUSTOMER');
    const res = await request(app).get(api('/users')).set(customer.authHeader);
    expect(res.status).toBe(403);
  });

  it('không có token → 401 (chưa tới bước check role)', async () => {
    const res = await request(app).get(api('/users'));
    expect(res.status).toBe(401);
  });
});

describe('GET /users (ADMIN)', () => {
  beforeEach(async () => {
    await createUser({ email: 'a.customer@test.local', full_name: 'An Nguyễn' });
    await createUser({ email: 'b.staff@test.local', roleName: 'STAFF', full_name: 'Bình Lê' });
    await createUser({ email: 'c.locked@test.local', status: 'LOCKED', full_name: 'Cường Trần' });
  });

  it('trả danh sách có pagination meta, không lộ password_hash', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/users?limit=2')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 4, totalPages: 2 });
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('filter theo role và status', async () => {
    const admin = await loginAs('ADMIN');

    const staffOnly = await request(app).get(api('/users?role=STAFF')).set(admin.authHeader);
    expect(staffOnly.body.data.every((u) => u.roles.includes('STAFF'))).toBe(true);

    const locked = await request(app).get(api('/users?status=LOCKED')).set(admin.authHeader);
    expect(locked.body.data).toHaveLength(1);
    expect(locked.body.data[0].email).toBe('c.locked@test.local');
  });

  it('tìm theo q khớp email hoặc tên', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/users?q=Bình')).set(admin.authHeader);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe('b.staff@test.local');
  });

  it('sort field ngoài whitelist bị bỏ qua, không gây lỗi', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .get(api('/users?sort=password_hash:asc'))
      .set(admin.authHeader);
    expect(res.status).toBe(200);
  });
});

describe('POST /users (ADMIN)', () => {
  it('tạo STAFF thành công, trả roles đúng', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app)
      .post(api('/users'))
      .set(admin.authHeader)
      .send({
        email: 'newstaff@test.local',
        password: 'Password123',
        full_name: 'Nhân viên mới',
        phone: '0912345678',
        role_ids: [roles.STAFF.id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.roles).toEqual(['STAFF']);
    await expect(login('newstaff@test.local', 'Password123')).resolves.toBeTruthy();
  });

  it('tạo CUSTOMER thì có luôn profile + cart', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app)
      .post(api('/users'))
      .set(admin.authHeader)
      .send({
        email: 'newcus@test.local',
        password: 'Password123',
        full_name: 'Khách do admin tạo',
        role_ids: [roles.CUSTOMER.id],
      });

    expect(res.status).toBe(201);
    const customer = await prisma.customer.findFirst({
      where: { user_id: res.body.data.id },
      include: { cart: true },
    });
    expect(customer?.cart).not.toBeNull();
  });

  it('role_id không tồn tại → 400', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .post(api('/users'))
      .set(admin.authHeader)
      .send({
        email: 'badrole@test.local',
        password: 'Password123',
        full_name: 'Role rác',
        role_ids: [9999],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('role_ids');
  });

  it('email trùng → 409', async () => {
    const admin = await loginAs('ADMIN');
    await createUser({ email: 'taken@test.local' });

    const res = await request(app)
      .post(api('/users'))
      .set(admin.authHeader)
      .send({
        email: 'taken@test.local',
        password: 'Password123',
        full_name: 'Trùng',
        role_ids: [roles.STAFF.id],
      });

    expect(res.status).toBe(409);
  });
});

describe('PUT /users/:id (ADMIN)', () => {
  it('đổi tên và thay toàn bộ role', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'target@test.local' });

    const res = await request(app)
      .put(api(`/users/${user.id}`))
      .set(admin.authHeader)
      .send({ full_name: 'Tên mới', role_ids: [roles.STAFF.id] });

    expect(res.status).toBe(200);
    expect(res.body.data.full_name).toBe('Tên mới');
    expect(res.body.data.roles).toEqual(['STAFF']);
  });

  it('user không tồn tại → 404', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .put(api('/users/999999'))
      .set(admin.authHeader)
      .send({ full_name: 'Không có ai' });
    expect(res.status).toBe(404);
  });

  it('body rỗng → 400', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'empty@test.local' });
    const res = await request(app).put(api(`/users/${user.id}`)).set(admin.authHeader).send({});
    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/:id/status (ADMIN)', () => {
  it('khóa user → thu hồi session, user đó không đăng nhập được nữa', async () => {
    const admin = await loginAs('ADMIN');
    const victim = await loginAs('CUSTOMER', { email: 'victim@test.local' });

    const res = await request(app)
      .patch(api(`/users/${victim.user.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'LOCKED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('LOCKED');

    // Access token cũ chết, refresh token cũ cũng chết, login lại cũng bị chặn.
    const meRes = await request(app).get(api('/auth/me')).set(victim.authHeader);
    expect(meRes.status).toBe(403);

    const refreshRes = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: victim.refreshToken });
    expect(refreshRes.status).toBe(401);

    const loginRes = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'victim@test.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(403);
  });

  it('tự khóa chính mình → 409', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .patch(api(`/users/${admin.user.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'LOCKED' });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('your own status');
  });

  it('mở khóa lại thì đăng nhập được', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'unlock@test.local', status: 'LOCKED' });

    await request(app)
      .patch(api(`/users/${user.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'ACTIVE' });

    await expect(login('unlock@test.local')).resolves.toBeTruthy();
  });

  it('status không hợp lệ → 400', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'badstatus@test.local' });
    const res = await request(app)
      .patch(api(`/users/${user.id}/status`))
      .set(admin.authHeader)
      .send({ status: 'BANNED' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /users/:id/reset-password và DELETE /users/:id (ADMIN)', () => {
  it('admin đặt lại mật khẩu cho user', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'needreset@test.local' });

    const res = await request(app)
      .patch(api(`/users/${user.id}/reset-password`))
      .set(admin.authHeader)
      .send({ new_password: 'AdminSet123' });

    expect(res.status).toBe(200);
    await expect(login('needreset@test.local', 'AdminSet123')).resolves.toBeTruthy();
  });

  it('soft delete: user biến mất khỏi list và không đăng nhập được, row vẫn còn trong DB', async () => {
    const admin = await loginAs('ADMIN');
    const { user } = await createUser({ email: 'todelete@test.local' });

    const res = await request(app).delete(api(`/users/${user.id}`)).set(admin.authHeader);
    expect(res.status).toBe(200);

    const listRes = await request(app).get(api('/users')).set(admin.authHeader);
    expect(listRes.body.data.some((u) => u.email === 'todelete@test.local')).toBe(false);

    const loginRes = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'todelete@test.local', password: TEST_PASSWORD });
    expect(loginRes.status).toBe(401);

    const row = await prisma.user.findUnique({ where: { id: user.id } });
    expect(row).not.toBeNull();
    expect(row.deleted_at).not.toBeNull();
  });

  it('tự xóa chính mình → 409', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).delete(api(`/users/${admin.user.id}`)).set(admin.authHeader);
    expect(res.status).toBe(409);
  });
});
