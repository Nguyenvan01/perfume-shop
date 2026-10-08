'use strict';

const request = require('supertest');
const app = require('../../src/app');
const env = require('../../src/config/env');
const { truncateAll } = require('../setup');
const { seedRbac, loginAs } = require('../helpers/auth');

const api = (path) => `/api/v1${path}`;

const validBody = {
  task: 'Compare two checkout approaches.',
  providers: ['openai', 'anthropic'],
  timeout_ms: 30_000,
};

beforeEach(async () => {
  await truncateAll();
  await seedRbac();
});

describe('Agents — authorization (ADMIN only)', () => {
  it('không có token → 401', async () => {
    const models = await request(app).get(api('/agents/models'));
    const run = await request(app).post(api('/agents/runs')).send(validBody);

    expect(models.status).toBe(401);
    expect(run.status).toBe(401);
  });

  it.each(['STAFF', 'CUSTOMER'])('%s → 403', async (roleName) => {
    const session = await loginAs(roleName);

    const models = await request(app).get(api('/agents/models')).set(session.authHeader);
    const run = await request(app).post(api('/agents/runs')).set(session.authHeader).send(validBody);

    expect(models.status).toBe(403);
    expect(run.status).toBe(403);
  });
});

describe('GET /agents/models', () => {
  it('ADMIN → 200, liệt kê 3 provider và không lộ API key', async () => {
    const admin = await loginAs('ADMIN');

    const res = await request(app).get(api('/agents/models')).set(admin.authHeader);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.map((item) => item.provider)).toEqual(['openai', 'anthropic', 'gemini']);
    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual(['enabled', 'model', 'provider']);
    }

    const raw = JSON.stringify(res.body);
    expect(raw.toLowerCase()).not.toContain('key');
    for (const secret of [env.AGENT_OPENAI_API_KEY, env.AGENT_ANTHROPIC_API_KEY, env.AGENT_GEMINI_API_KEY]) {
      if (secret) expect(raw).not.toContain(secret);
    }
  });
});

describe('POST /agents/runs — validation', () => {
  let admin;

  beforeEach(async () => {
    admin = await loginAs('ADMIN');
  });

  const post = (body) => request(app).post(api('/agents/runs')).set(admin.authHeader).send(body);

  it.each([
    ['chỉ 1 provider', { providers: ['openai'] }, 'providers'],
    ['provider trùng', { providers: ['openai', 'openai'] }, 'providers'],
    ['provider không hỗ trợ', { providers: ['openai', 'mistral'] }, 'providers.1'],
    ['task vượt độ dài tối đa', { task: 'x'.repeat(12_001) }, 'task'],
    ['task rỗng', { task: '   ' }, 'task'],
    ['timeout_ms quá nhỏ', { timeout_ms: 999 }, 'timeout_ms'],
    ['timeout_ms quá lớn', { timeout_ms: 120_001 }, 'timeout_ms'],
  ])('%s → 400', async (_label, override, field) => {
    const res = await post({ ...validBody, ...override });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Validation failed');
    expect(res.body.errors.map((error) => error.field)).toContain(field);
  });
});
