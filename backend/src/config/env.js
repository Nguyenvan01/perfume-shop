'use strict';

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const NODE_ENV = process.env.NODE_ENV || 'development';
const isTest = NODE_ENV === 'test';

/** Biến bắt buộc — thiếu thì fail-fast ngay khi boot, không chạy với cấu hình nửa vời. */
const REQUIRED = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function readNumber(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Env ${key} must be a number, received "${raw}"`);
  }
  return parsed;
}

const databaseUrl = isTest
  ? process.env.DATABASE_URL_TEST || process.env.DATABASE_URL
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isTest
      ? 'Missing DATABASE_URL_TEST (or DATABASE_URL) for NODE_ENV=test'
      : 'Missing DATABASE_URL'
  );
}

// Prisma luôn đọc DATABASE_URL — ở môi trường test ta trỏ nó sang DB test.
process.env.DATABASE_URL = databaseUrl;

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required env variables: ${missing.join(', ')}`);
}

const env = {
  NODE_ENV,
  isDevelopment: NODE_ENV === 'development',
  isProduction: NODE_ENV === 'production',
  isTest,
  PORT: readNumber('PORT', 4000),

  DATABASE_URL: databaseUrl,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || '15m',
  JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || '7d',

  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  LOW_STOCK_THRESHOLD: readNumber('LOW_STOCK_THRESHOLD', 5),
  DEFAULT_SHIPPING_FEE: readNumber('DEFAULT_SHIPPING_FEE', 30000),

  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  SEED_PASSWORD: process.env.SEED_PASSWORD || '',
};

module.exports = env;
