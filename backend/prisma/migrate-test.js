'use strict';

/** Áp migration lên DB test (NODE_ENV=test → env.js tự trỏ DATABASE_URL sang DATABASE_URL_TEST). */
process.env.NODE_ENV = 'test';

const { execFileSync } = require('child_process');
const env = require('../src/config/env');

// eslint-disable-next-line no-console
console.log(`[migrate:test] target = ${env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
});
