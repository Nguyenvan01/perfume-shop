'use strict';

/**
 * Entry cho Vercel Serverless Function (Node runtime).
 *
 * Express app là một request handler `(req, res)` nên export thẳng là đủ —
 * KHÔNG gọi `app.listen` ở đây (Vercel tự gọi handler cho mỗi request).
 * `vercel.json` rewrite mọi path về `/api` nên Express vẫn thấy path gốc
 * (`/api/v1/...`) và routing giữ nguyên như khi chạy local.
 *
 * Module được giữ lại giữa các lần gọi "warm" của cùng instance, nên
 * Prisma client (singleton trong `src/config/database.js`) được tái sử dụng.
 *
 * Local dev vẫn dùng `src/server.js` (`npm run dev` / `npm start`).
 */
module.exports = require('../src/app');
