'use strict';

const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/v1/health', () => {
  it('trả 200 với envelope chuẩn và DB up', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: {
        status: 'ok',
        db: 'up',
        uptime: expect.any(Number),
        version: expect.any(String),
      },
    });
  });
});

describe('Route không tồn tại', () => {
  it('trả 404 với envelope lỗi chuẩn', async () => {
    const res = await request(app).get('/api/v1/khong-ton-tai');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not found');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });
});
