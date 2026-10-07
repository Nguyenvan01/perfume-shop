'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const AppError = require('./utils/AppError');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');
const { globalLimiter, limitWrites } = require('./middleware/security.middleware');

const app = express();

// Frontend ở origin khác nên ảnh trong /uploads phải cho phép cross-origin.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // API không trả HTML nên CSP mặc định của helmet không giúp gì mà dễ chặn ảnh.
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  })
);

// Sau proxy (Render/Railway) thì rate limit phải đọc IP thật từ X-Forwarded-For.
if (env.isProduction) app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, callback) {
      // Cho phép request không có Origin (Postman, server-to-server, health check).
      if (!origin || env.CORS_ORIGIN.includes(origin)) return callback(null, true);
      return callback(AppError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

// Giới hạn body: JSON của API không bao giờ cần tới 1MB; file đi qua multer.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

if (!env.isTest) {
  // Không log body/header: request đăng nhập chứa mật khẩu, request khác chứa token.
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.use(globalLimiter);

// Storage driver `local` (OD-5): serve file đã upload.
if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads', express.static(path.resolve(__dirname, '..', env.UPLOAD_DIR)));
}

app.use('/api/v1', limitWrites, routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
