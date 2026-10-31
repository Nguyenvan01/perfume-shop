'use strict';

const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Singleton: tránh tạo nhiều connection pool khi nodemon reload hoặc test chạy nhiều file.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prismaClient ||
  new PrismaClient({
    log: env.isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (!globalForPrisma.__prismaClient) {
  globalForPrisma.__prismaClient = prisma;
}

/** Ping DB — dùng cho health check. */
async function checkDatabaseConnection() {
  await prisma.$queryRaw`SELECT 1`;
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

/** Quy ước: DB dùng cho test (bị TRUNCATE / migrate tự động) phải có tên kết thúc bằng `_test`. */
const TEST_DATABASE_SUFFIX = '_test';

/**
 * Chốt chặn cuối trước thao tác phá dữ liệu (TRUNCATE của test, migrate DB test):
 * hỏi chính server đang kết nối tên DB là gì, không tin vào chuỗi URL.
 * @param {{ $queryRaw: Function }} [client]
 * @returns {Promise<string>} tên database
 */
async function assertTestDatabase(client = prisma) {
  const rows = await client.$queryRaw`SELECT current_database() AS name`;
  const name = rows[0]?.name;
  if (typeof name !== 'string' || !name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Refusing destructive test operation: connected database "${name}" does not end with "${TEST_DATABASE_SUFFIX}"`
    );
  }
  return name;
}

module.exports = { prisma, checkDatabaseConnection, disconnectDatabase, assertTestDatabase };
