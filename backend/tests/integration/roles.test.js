'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, createUser, loginAs } = require('../helpers/auth');

const api = (path) => `/api/v1${path}`;

let roles;
let permissions;

beforeEach(async () => {
  await truncateAll();
  ({ roles, permissions } = await seedRbac());
});

describe('GET /roles', () => {
  it('trả 3 role kèm permission codes và số user đang gán', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/roles')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.name).sort()).toEqual(['ADMIN', 'CUSTOMER', 'STAFF']);

    const adminRole = res.body.data.find((r) => r.name === 'ADMIN');
    expect(adminRole.permissions).toContain('user.view');
    expect(adminRole.is_system).toBe(true);
    expect(adminRole.user_count).toBe(1);

    // STAFF không được cấp permission admin-only.
    const staffRole = res.body.data.find((r) => r.name === 'STAFF');
    expect(staffRole.permissions).not.toContain('user.view');
    expect(staffRole.permissions).toContain('product.create');
  });
});

describe('GET /permissions', () => {
  it('trả danh sách permission', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/permissions')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.code)).toContain('product.view');
  });
});

describe('POST /roles', () => {
  it('tạo role mới với permission', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app)
      .post(api('/roles'))
      .set(admin.authHeader)
      .send({
        name: 'WAREHOUSE',
        description: 'Nhân viên kho',
        permission_ids: [permissions['product.view'].id],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('WAREHOUSE');
    expect(res.body.data.permissions).toEqual(['product.view']);
    expect(res.body.data.is_system).toBe(false);
  });

  it('tên role trùng → 409', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .post(api('/roles'))
      .set(admin.authHeader)
      .send({ name: 'STAFF' });

    expect(res.status).toBe(409);
  });

  it('tên không đúng UPPER_SNAKE_CASE → 400', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .post(api('/roles'))
      .set(admin.authHeader)
      .send({ name: 'warehouse manager' });

    expect(res.status).toBe(400);
  });

  it('permission_id không tồn tại → 400', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app)
      .post(api('/roles'))
      .set(admin.authHeader)
      .send({ name: 'GHOST', permission_ids: [99999] });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('permission_ids');
  });
});

describe('PUT /roles/:id', () => {
  it('thay toàn bộ permission (không merge)', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app)
      .put(api(`/roles/${roles.STAFF.id}`))
      .set(admin.authHeader)
      .send({ permission_ids: [permissions['product.view'].id] });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(['product.view']);
  });

  it('bỏ hết permission được phép (mảng rỗng)', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app)
      .put(api(`/roles/${roles.STAFF.id}`))
      .set(admin.authHeader)
      .send({ permission_ids: [] });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual([]);
  });

  it('đổi permission của role làm thay đổi /auth/me của user thuộc role đó', async () => {
    const admin = await loginAs('ADMIN');
    const staff = await loginAs('STAFF');

    const before = await request(app).get(api('/auth/me')).set(staff.authHeader);
    expect(before.body.data.permissions).toContain('product.create');

    await request(app)
      .put(api(`/roles/${roles.STAFF.id}`))
      .set(admin.authHeader)
      .send({ permission_ids: [permissions['product.view'].id] });

    const after = await request(app).get(api('/auth/me')).set(staff.authHeader);
    expect(after.body.data.permissions).toEqual(['product.view']);
  });
});

describe('DELETE /roles/:id', () => {
  it('role hệ thống → 409', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).delete(api(`/roles/${roles.STAFF.id}`)).set(admin.authHeader);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('System role cannot be deleted');
  });

  it('role còn user đang gán → 409', async () => {
    const admin = await loginAs('ADMIN');
    const custom = await prisma.role.create({ data: { name: 'TEMP_ROLE' } });
    const { user } = await createUser({ email: 'hastemprole@test.local' });
    await prisma.userRole.create({ data: { user_id: user.id, role_id: custom.id } });

    const res = await request(app).delete(api(`/roles/${custom.id}`)).set(admin.authHeader);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Role is still assigned to users');
  });

  it('role tự tạo, chưa gán ai → xóa được', async () => {
    const admin = await loginAs('ADMIN');
    const custom = await prisma.role.create({ data: { name: 'UNUSED_ROLE' } });

    const res = await request(app).delete(api(`/roles/${custom.id}`)).set(admin.authHeader);
    expect(res.status).toBe(200);
    expect(await prisma.role.findUnique({ where: { id: custom.id } })).toBeNull();
  });

  it('id không tồn tại → 404', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).delete(api('/roles/99999')).set(admin.authHeader);
    expect(res.status).toBe(404);
  });
});
