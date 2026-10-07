'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

/**
 * Rate limit chung cho toàn API. Tắt ở môi trường test để không làm nhiễu
 * test suite (nhiều test gọi hàng chục request liên tiếp).
 */
const passthrough = (_req, _res, next) => next();

const createLimiter = ({ windowMs, limit, message }) =>
  env.isTest
    ? passthrough
    : rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message, errors: [] },
      });

/** Toàn API: chặn quét/spam ở mức thô. */
const globalLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down.',
});

/** Ghi dữ liệu nặng hơn đọc, nên giới hạn chặt hơn. */
const writeLimiter = createLimiter({
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Too many write requests. Please slow down.',
});

/** Chỉ áp cho method ghi, để GET không bị ảnh hưởng. */
const limitWrites = (req, res, next) =>
  ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ? writeLimiter(req, res, next)
    : next();

module.exports = { globalLimiter, limitWrites };
