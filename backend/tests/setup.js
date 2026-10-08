'use strict';

process.env.NODE_ENV = 'test';

const { prisma } = require('../src/config/database');

/**
 * Mọi bảng nghiệp vụ (không gồm `_prisma_migrations`).
 * Dùng cho test cần DB sạch; test đọc dữ liệu seed thì không gọi.
 */
const TABLES = [
  'promotion_usages',
  'order_details',
  'payments',
  'orders',
  'cart_items',
  'carts',
  'reviews',
  'inventory_transactions',
  'product_images',
  'product_variants',
  'products',
  'categories',
  'brands',
  'promotions',
  'password_reset_tokens',
  'refresh_tokens',
  'customers',
  'user_roles',
  'role_permissions',
  'permissions',
  'roles',
  'users',
];

const TRUNCATE_SQL = `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`;

/**
 * PostgreSQL: một lệnh TRUNCATE cho tất cả bảng — atomic, không cần tắt FK check,
 * thứ tự bảng không quan trọng. RESTART IDENTITY reset sequence để id bắt đầu lại từ 1.
 */
async function truncateAll() {
  await prisma.$executeRawUnsafe(TRUNCATE_SQL);
}

global.truncateAll = truncateAll;
global.testPrisma = prisma;

afterAll(async () => {
  await prisma.$disconnect();
});

module.exports = { truncateAll, prisma };
