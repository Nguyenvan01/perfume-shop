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

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

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

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

// Storage driver `local` (OD-5): serve file đã upload.
if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads', express.static(path.resolve(__dirname, '..', env.UPLOAD_DIR)));
}

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
