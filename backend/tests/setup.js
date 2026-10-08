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
  // FOREIGN_KEY_CHECKS là biến theo session: phải chạy mọi lệnh trên cùng 1 connection,
  // nếu không pool có thể đưa TRUNCATE sang connection vẫn bật FK check → lỗi 1701.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES_CHILD_FIRST) {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\``);
    }
    await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
  }, { timeout: 30_000 }); // 22 lệnh TRUNCATE có thể vượt timeout mặc định 5s
}

global.truncateAll = truncateAll;
global.testPrisma = prisma;

afterAll(async () => {
  await prisma.$disconnect();
});

module.exports = { truncateAll, prisma };
