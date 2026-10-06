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

module.exports = { prisma, checkDatabaseConnection, disconnectDatabase };
