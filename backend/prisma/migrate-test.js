'use strict';

/**
 * Áp migration lên DB test. NODE_ENV=test → env.js trỏ DATABASE_URL sang DATABASE_URL_TEST
 * và DIRECT_URL sang DIRECT_URL_TEST (mặc định = DATABASE_URL_TEST).
 * Prisma Migrate kết nối qua DIRECT_URL, nên phải truyền cả hai — thiếu DIRECT_URL thì
 * CLI sẽ đọc DIRECT_URL của DB dev trong .env và migrate nhầm DB.
 */
process.env.NODE_ENV = 'test';

const { execFileSync } = require('child_process');
const env = require('../src/config/env');

const mask = (url) => url.replace(/:[^:@/]+@/, ':***@');

// eslint-disable-next-line no-console
console.log(`[migrate:test] target = ${mask(env.DIRECT_URL)}`);

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL },
});
