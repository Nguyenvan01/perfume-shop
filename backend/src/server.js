'use strict';

const app = require('./app');
const env = require('./config/env');
const { checkDatabaseConnection, disconnectDatabase } = require('./config/database');

async function start() {
  try {
    await checkDatabaseConnection();
    // eslint-disable-next-line no-console
    console.log('[db] connected');
  } catch (error) {
    // Message của Prisma khi connect lỗi có thể chứa cả connection string
    // (kèm mật khẩu) — che lại trước khi ghi log.
    const safeMessage = String(error.message).replace(/:\/\/([^:]+):[^@]+@/g, '://$1:***@');
    // eslint-disable-next-line no-console
    console.error('[db] connection failed:', safeMessage);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
