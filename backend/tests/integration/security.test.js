'use strict';

const request = require('supertest');
const app = require('../../src/app');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs, createUser } = require('../helpers/auth');

const api = (path) => `/api/v1${path}`;

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
});

describe('Không rò rỉ dữ liệu nhạy cảm qua API', () => {
  it('không endpoint nào trả password_hash', async () => {
    const admin = await loginAs('ADMIN');
    await createUser({ email: 'leak-check@test.local' });

    const responses = await Promise.all([
      request(app).get(api('/users')).set(admin.authHeader),
      request(app).get(api('/customers')).set(admin.authHeader),
      request(app).get(api('/auth/me')).set(admin.authHeader),
      request(app).get(api('/roles')).set(admin.authHeader),
    ]);

    for (const res of responses) {
      expect(JSON.stringify(res.body)).not.toContain('password_hash');
      expect(JSON.stringify(res.body)).not.toContain('password');
    }
  });

  it('không trả token_hash của refresh token', async () => {
    const session = await loginAs('CUSTOMER');
    const res = await request(app).get(api('/auth/me')).set(session.authHeader);
    expect(JSON.stringify(res.body)).not.toContain('token_hash');
  });

  it('product DTO không lộ cờ nội bộ deleted_at', async () => {
    const res = await request(app).get(api('/products'));
    expect(JSON.stringify(res.body)).not.toContain('deleted_at');
  });
});

describe('Header bảo mật', () => {
  it('helmet đặt các header cơ bản', async () => {
    const res = await request(app).get(api('/health'));
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });

  it('ảnh trong /uploads cho phép cross-origin để frontend khác origin hiển thị được', async () => {
    const res = await request(app).get(api('/health'));
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});

describe('CORS', () => {
  it('cho phép origin đã cấu hình', async () => {
    const res = await request(app)
      .get(api('/health'))
      .set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('origin lạ → 403, không trả header cho phép', async () => {
    const res = await request(app).get(api('/health')).set('Origin', 'http://evil.example.com');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('request không có Origin (Postman, health check) vẫn chạy', async () => {
    expect((await request(app).get(api('/health'))).status).toBe(200);
  });
});

describe('Giới hạn kích thước body', () => {
  it('JSON quá lớn → 413 (lỗi của client), không phải 500', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'a@b.local', password: 'x'.repeat(400_000) });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('too large');
  });

  it('body vừa trong giới hạn vẫn xử lý bình thường', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: 'a@b.local', password: 'x'.repeat(100) });

    // Sai mật khẩu là đúng — điều cần kiểm là request được xử lý, không bị chặn vì size.
    expect(res.status).toBe(401);
  });
});

describe('Xử lý input lỗi', () => {
  it('JSON sai cú pháp → 400 chứ không 500', async () => {
    const res = await request(app)
      .post(api('/auth/login'))
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.local", bad json}');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('token rác → 401 với message rõ ràng', async () => {
    const res = await request(app).get(api('/auth/me')).set('Authorization', 'Bearer khong-phai-jwt');
    expect(res.status).toBe(401);
  });

  it('header Authorization sai định dạng → 401', async () => {
    const res = await request(app).get(api('/auth/me')).set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Missing access token');
  });

  it('route không tồn tại → 404 với envelope chuẩn', async () => {
    const res = await request(app).get(api('/khong-ton-tai'));
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, errors: [] });
  });

  it('id không phải số ở route nhận id số → 400 chứ không 500', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/users/abc')).set(admin.authHeader);
    expect(res.status).toBe(400);
  });
});

describe('Response envelope nhất quán', () => {
  it('thành công luôn có success/message/data', async () => {
    const res = await request(app).get(api('/health'));
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('data');
  });

  it('list luôn có meta phân trang', async () => {
    const res = await request(app).get(api('/products'));
    expect(res.body.meta).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it('lỗi luôn có success false + message + errors array', async () => {
    const res = await request(app).post(api('/auth/login')).send({ email: 'sai' });
    expect(res.body).toMatchObject({ success: false, message: expect.any(String) });
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});

describe('Sort field không nằm trong whitelist bị bỏ qua', () => {
  it('không cho sort theo password_hash', async () => {
    const admin = await loginAs('ADMIN');
    const res = await request(app).get(api('/users?sort=password_hash:asc')).set(admin.authHeader);
    expect(res.status).toBe(200);
  });

  it('limit vượt mức cho phép bị chặn ở 400', async () => {
    const res = await request(app).get(api('/products?limit=100000'));
    expect(res.status).toBe(400);
  });
});
