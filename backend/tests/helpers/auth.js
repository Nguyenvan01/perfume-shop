'use strict';

const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { BCRYPT_ROUNDS } = require('../../src/modules/auth/auth.constant');

const TEST_PASSWORD = 'Password123';

/** Permission tối thiểu để test authorization, không cần seed đủ 66 code. */
const PERMISSION_CODES = ['product.view', 'product.create', 'user.view', 'role.view'];
const ADMIN_ONLY = ['user.view', 'role.view'];

/**
 * Dựng RBAC cơ bản: 3 role + permission + gán cho ADMIN/STAFF.
 * Gọi sau truncateAll() trong beforeEach của mỗi test file.
 */
async function seedRbac() {
  const roles = {};
  for (const [name, description] of [
    ['ADMIN', 'Toàn quyền'],
    ['STAFF', 'Nhân viên'],
    ['CUSTOMER', 'Khách hàng'],
  ]) {
    roles[name] = await prisma.role.create({ data: { name, description, is_system: true } });
  }

  const permissions = {};
  for (const code of PERMISSION_CODES) {
    permissions[code] = await prisma.permission.create({ data: { code, description: code } });
  }

  await prisma.rolePermission.createMany({
    data: [
      ...PERMISSION_CODES.map((code) => ({
        role_id: roles.ADMIN.id,
        permission_id: permissions[code].id,
      })),
      ...PERMISSION_CODES.filter((code) => !ADMIN_ONLY.includes(code)).map((code) => ({
        role_id: roles.STAFF.id,
        permission_id: permissions[code].id,
      })),
    ],
  });

  return { roles, permissions };
}

/** Tạo user có role cho trước; role CUSTOMER được tạo kèm profile + cart như luồng register. */
async function createUser({
  email,
  roleName = 'CUSTOMER',
  password = TEST_PASSWORD,
  full_name = 'Người dùng test',
  status = 'ACTIVE',
}) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Role ${roleName} not found — call seedRbac() first`);

  const user = await prisma.user.create({
    data: {
      email,
      password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      full_name,
      status,
    },
  });

  await prisma.userRole.create({ data: { user_id: user.id, role_id: role.id } });

  let customer = null;
  if (roleName === 'CUSTOMER') {
    customer = await prisma.customer.create({ data: { user_id: user.id } });
    await prisma.cart.create({ data: { customer_id: customer.id } });
  }

  return { user, customer, password };
}

/** Đăng nhập qua HTTP thật để test đi đúng luồng production. */
async function login(email, password = TEST_PASSWORD) {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

/** Tạo user + đăng nhập, trả kèm header Authorization dùng ngay được. */
async function loginAs(roleName, overrides = {}) {
  const email = overrides.email ?? `${roleName.toLowerCase()}@test.local`;
  const { user, customer, password } = await createUser({ ...overrides, email, roleName });
  const session = await login(email, password);
  return {
    user,
    customer,
    ...session,
    authHeader: { Authorization: `Bearer ${session.accessToken}` },
  };
}

module.exports = { seedRbac, createUser, login, loginAs, TEST_PASSWORD, PERMISSION_CODES };
