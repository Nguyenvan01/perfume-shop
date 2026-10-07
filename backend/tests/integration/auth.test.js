'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { prisma } = require('../../src/config/database');
const { truncateAll } = require('../setup');
const { seedRbac, createUser, login, loginAs, TEST_PASSWORD } = require('../helpers/auth');

const api = (path) => `/api/v1${path}`;

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
});

describe('POST /auth/register', () => {
  it('tạo user + profile customer + cart, trả token và không lộ password', async () => {
    const res = await request(app).post(api('/auth/register')).send({
      email: 'newuser@test.local',
      password: 'Password123',
      full_name: 'Khách mới',
      phone: '0901234567',
      address: '1 Lê Lợi, Q1',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      email: 'newuser@test.local',
      full_name: 'Khách mới',
      roles: ['CUSTOMER'],
    });
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('password_hash');

    // Profile nghiệp vụ + cart phải được tạo cùng transaction (OD-2).
    const customer = await prisma.customer.findFirst({
      where: { user: { email: 'newuser@test.local' } },
      include: { cart: true },
    });
    expect(customer).not.toBeNull();
    expect(customer.address).toBe('1 Lê Lợi, Q1');
    expect(customer.cart).not.toBeNull();
  });

  it('email trùng → 409', async () => {
    await createUser({ email: 'dup@test.local' });
    const res = await request(app)
      .post(api('/auth/register'))
      .send({ email: 'dup@test.local', password: 'Password123', full_name: 'Trùng email' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already registered');
  });

  it('mật khẩu yếu → 400 kèm errors[]', async () => {
    const res = await request(app)
      .post(api('/auth/register'))
      .send({ email: 'weak@test.local', password: 'abc', full_name: 'Mật khẩu yếu' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.some((e) => e.field.includes('password'))).toBe(true);
  });
});

describe('POST /auth/login', () => {
  it('TC01 — đúng thông tin → 200 kèm token và roles', async () => {
    await createUser({ email: 'admin@test.local', roleName: 'ADMIN' });

    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'admin@test.local', password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.roles).toEqual(['ADMIN']);
  });

  it('TC02 — sai mật khẩu → 401, không trả token', async () => {
    await createUser({ email: 'admin@test.local', roleName: 'ADMIN' });

    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'admin@test.local', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
    expect(res.body.data).toBeUndefined();
    expect(res.body.accessToken).toBeUndefined();
  });

  it('email không tồn tại → 401 với cùng message (không tiết lộ email đã đăng ký)', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'nobody@test.local', password: TEST_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('tài khoản bị khóa → 403', async () => {
    await createUser({ email: 'locked@test.local', status: 'LOCKED' });

    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'locked@test.local', password: TEST_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account is locked');
  });
});

describe('POST /auth/refresh', () => {
  it('đổi được cặp token mới và thu hồi token cũ (rotation)', async () => {
    const session = await loginAs('CUSTOMER');

    const first = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.refreshToken });

    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();
    expect(first.body.data.refreshToken).not.toBe(session.refreshToken);

    // Dùng lại token đã rotate → bị từ chối.
    const reuse = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.refreshToken });

    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toBe('Refresh token has been revoked');
  });

  it('dùng lại token đã thu hồi → hạ toàn bộ session của user', async () => {
    const session = await loginAs('CUSTOMER');
    const rotated = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.refreshToken });

    // Lần reuse làm revoke all → token mới vừa phát cũng mất hiệu lực.
    await request(app).post(api('/auth/refresh')).send({ refreshToken: session.refreshToken });

    const res = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: rotated.body.data.refreshToken });

    expect(res.status).toBe(401);
  });

  it('token rác → 401', async () => {
    const res = await request(app).post(api('/auth/refresh')).send({ refreshToken: 'not-a-jwt' });
    expect(res.status).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('trả profile kèm roles, permissions, address — không có password', async () => {
    const session = await loginAs('ADMIN');

    const res = await request(app).get(api('/auth/me')).set(session.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual(['ADMIN']);
    expect(res.body.data.permissions).toContain('user.view');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('thiếu token → 401', async () => {
    const res = await request(app).get(api('/auth/me'));
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing access token');
  });

  it('token của user bị khóa sau khi đã đăng nhập → 403', async () => {
    const session = await loginAs('CUSTOMER');
    await prisma.user.update({ where: { id: session.user.id }, data: { status: 'LOCKED' } });

    const res = await request(app).get(api('/auth/me')).set(session.authHeader);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Account is locked');
  });
});

describe('PUT /auth/me', () => {
  it('cập nhật tên, phone và address (address nằm ở bảng customers)', async () => {
    const session = await loginAs('CUSTOMER');

    const res = await request(app)
      .put(api('/auth/me'))
      .set(session.authHeader)
      .send({ full_name: 'Tên đã đổi', phone: '0987654321', address: '99 Hai Bà Trưng' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      full_name: 'Tên đã đổi',
      phone: '0987654321',
      address: '99 Hai Bà Trưng',
    });
  });

  it('ADMIN không có profile customer → đổi address trả 400', async () => {
    const session = await loginAs('ADMIN');

    const res = await request(app)
      .put(api('/auth/me'))
      .set(session.authHeader)
      .send({ address: '1 Nguyễn Trãi' });

    expect(res.status).toBe(400);
  });
});

describe('POST /auth/change-password', () => {
  it('đổi mật khẩu thành công và thu hồi session cũ', async () => {
    const session = await loginAs('CUSTOMER', { email: 'changepw@test.local' });

    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(session.authHeader)
      .send({ current_password: TEST_PASSWORD, new_password: 'NewPassword123' });

    expect(res.status).toBe(200);

    // Mật khẩu mới dùng được, refresh token cũ đã bị thu hồi.
    await expect(login('changepw@test.local', 'NewPassword123')).resolves.toBeTruthy();
    const refreshRes = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it('sai mật khẩu hiện tại → 401', async () => {
    const session = await loginAs('CUSTOMER');

    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(session.authHeader)
      .send({ current_password: 'WrongPassword1', new_password: 'NewPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Current password is incorrect');
  });

  it('mật khẩu mới trùng mật khẩu cũ → 400', async () => {
    const session = await loginAs('CUSTOMER');

    const res = await request(app)
      .post(api('/auth/change-password'))
      .set(session.authHeader)
      .send({ current_password: TEST_PASSWORD, new_password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });
});

describe('Forgot / reset password', () => {
  it('luồng đầy đủ: lấy token (dev) → đặt lại mật khẩu → đăng nhập bằng mật khẩu mới', async () => {
    await createUser({ email: 'forgot@test.local' });

    const forgot = await request(app)
      .post(api('/auth/forgot-password'))
      .send({ email: 'forgot@test.local' });

    expect(forgot.status).toBe(200);
    const token = forgot.body.data.reset_token;
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post(api('/auth/reset-password'))
      .send({ token, new_password: 'ResetPassword123' });

    expect(reset.status).toBe(200);
    await expect(login('forgot@test.local', 'ResetPassword123')).resolves.toBeTruthy();
  });

  it('email không tồn tại → vẫn 200, không trả token', async () => {
    const res = await request(app)
      .post(api('/auth/forgot-password'))
      .send({ email: 'nobody@test.local' });

    expect(res.status).toBe(200);
    expect(res.body.data.reset_token).toBeUndefined();
  });

  it('token dùng 2 lần → lần sau 410', async () => {
    await createUser({ email: 'once@test.local' });
    const forgot = await request(app)
      .post(api('/auth/forgot-password'))
      .send({ email: 'once@test.local' });
    const token = forgot.body.data.reset_token;

    await request(app).post(api('/auth/reset-password')).send({ token, new_password: 'First123456' });
    const second = await request(app)
      .post(api('/auth/reset-password'))
      .send({ token, new_password: 'Second123456' });

    expect(second.status).toBe(410);
  });

  it('token hết hạn → 410', async () => {
    const { user } = await createUser({ email: 'expired@test.local' });
    const { generateOpaqueToken } = require('../../src/utils/jwt');
    const { raw, hash } = generateOpaqueToken();
    await prisma.passwordResetToken.create({
      data: { user_id: user.id, token_hash: hash, expires_at: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post(api('/auth/reset-password'))
      .send({ token: raw, new_password: 'Whatever123' });

    expect(res.status).toBe(410);
    expect(res.body.message).toBe('Reset token has expired');
  });
});

describe('POST /auth/logout', () => {
  it('thu hồi refresh token, gọi lại refresh thất bại', async () => {
    const session = await loginAs('CUSTOMER');

    const res = await request(app)
      .post(api('/auth/logout'))
      .set(session.authHeader)
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(200);

    const refreshRes = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: session.refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
