'use strict';

/**
 * Áp migration lên DB test. NODE_ENV=test → env.js trỏ DATABASE_URL sang DATABASE_URL_TEST
 * và DIRECT_URL sang DIRECT_URL_TEST (mặc định = DATABASE_URL_TEST).
 * Prisma Migrate kết nối qua DIRECT_URL, nên phải truyền cả hai — thiếu DIRECT_URL thì
 * CLI sẽ đọc DIRECT_URL của DB dev trong .env và migrate nhầm DB.
 *
 * An toàn: env.js đã từ chối khi thiếu DATABASE_URL_TEST hoặc nó trùng DB dev; ở đây
 * hỏi thêm chính server (qua DIRECT_URL — đúng kết nối Migrate dùng) tên DB phải là `*_test`.
 */
process.env.NODE_ENV = 'test';

const { execFileSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const env = require('../src/config/env');
const { assertTestDatabase } = require('../src/config/database');

const mask = (url) => url.replace(/:[^:@/]+@/, ':***@');

async function main() {
  const directClient = new PrismaClient({ datasourceUrl: env.DIRECT_URL });
  try {
    await assertTestDatabase(directClient);
  } finally {
    await directClient.$disconnect();
  }

  // eslint-disable-next-line no-console
  console.log(`[migrate:test] target = ${mask(env.DIRECT_URL)}`);

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL },
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`[migrate:test] ${error.message}`);
    process.exit(1);
  });
