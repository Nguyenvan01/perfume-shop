'use strict';

process.env.NODE_ENV = 'test';

const { prisma } = require('../src/config/database');

/**
 * Thứ tự truncate quan trọng: xoá bảng con trước bảng cha.
 * Dùng cho test cần DB sạch; test đọc dữ liệu seed thì không gọi.
 */
const TABLES_CHILD_FIRST = [
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

async function truncateAll() {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES_CHILD_FIRST) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
}

global.truncateAll = truncateAll;
global.testPrisma = prisma;

afterAll(async () => {
  await prisma.$disconnect();
});

module.exports = { truncateAll, prisma };
