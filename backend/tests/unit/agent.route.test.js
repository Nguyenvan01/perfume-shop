'use strict';

const express = require('express');
const request = require('supertest');

/**
 * Limiters are passthrough under NODE_ENV=test, so this loads the real agent
 * router with a non-test env and stubbed auth to check the per-user run limit.
 */
function buildApp() {
  let router;
  jest.isolateModules(() => {
    jest.doMock('../../src/config/env', () => ({
      ...jest.requireActual('../../src/config/env'),
      isTest: false,
    }));
    jest.doMock('../../src/middleware/auth.middleware', () => ({
      authenticate: (req, _res, next) => {
        req.user = { id: Number(req.headers['x-user-id']), roles: ['ADMIN'] };
        next();
      },
    }));
    jest.doMock('../../src/middleware/role.middleware', () => ({
      requireRole: () => (_req, _res, next) => next(),
    }));
    jest.doMock('../../src/modules/agents/agent.controller', () => ({
      listModels: (_req, res) => res.json({ success: true }),
      run: (_req, res) => res.json({ success: true }),
    }));
    router = require('../../src/modules/agents/agent.route');
  });

  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

const { RUN_RATE_LIMIT } = require('../../src/modules/agents/agent.constant');

const body = { task: 'Compare', providers: ['openai', 'gemini'] };

describe('POST /agents/runs rate limit', () => {
  it(`allows ${RUN_RATE_LIMIT.limit} runs per minute per admin user, then 429`, async () => {
    const app = buildApp();
    const runAs = (userId) => request(app).post('/runs').set('x-user-id', String(userId)).send(body);

    for (let i = 0; i < RUN_RATE_LIMIT.limit; i += 1) {
      expect((await runAs(1)).status).toBe(200);
    }

    const blocked = await runAs(1);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: 'Too many agent runs. Please try again later.',
      errors: [],
    });

    // Another admin has their own budget; listing models is not limited.
    expect((await runAs(2)).status).toBe(200);
    expect((await request(app).get('/models').set('x-user-id', '1')).status).toBe(200);
  });

  it('rejects an invalid body with 400 without using up the run budget', async () => {
    const app = buildApp();
    const post = (payload) => request(app).post('/runs').set('x-user-id', '3').send(payload);

    for (let i = 0; i < RUN_RATE_LIMIT.limit + 2; i += 1) {
      expect((await post({ task: 'Compare', providers: ['openai'] })).status).toBe(400);
    }

    expect((await post(body)).status).toBe(200);
  });
});
