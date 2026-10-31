'use strict';

const { prisma } = require('../config/database');
const AppError = require('./AppError');

/** SQLSTATE đáng retry: deadlock_detected, serialization_failure. */
const RETRYABLE_SQLSTATES = ['40P01', '40001'];

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 25;

/**
 * Transaction bị DB hủy vì đụng transaction khác (deadlock / write conflict) —
 * chạy lại từ đầu là an toàn, khác với lỗi nghiệp vụ.
 *  - P2034: Prisma báo "write conflict or a deadlock".
 *  - P2010: lỗi trong $queryRaw (vd SELECT ... FOR UPDATE); SQLSTATE nằm ở meta.code.
 */
function isTransactionConflict(error) {
  if (error?.code === 'P2034') return true;
  return error?.code === 'P2010' && RETRYABLE_SQLSTATES.includes(error.meta?.code);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `prisma.$transaction(fn)` có retry giới hạn khi bị deadlock / write conflict.
 * `fn` phải tự đọc lại mọi thứ nó cần bên trong transaction (chạy lại được nhiều lần).
 * Hết lượt mà vẫn xung đột → 409 để client thử lại, thay vì 500.
 *
 * @template T
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} fn
 * @param {object} [options]
 * @param {number} [options.maxAttempts]
 * @param {number} [options.baseDelayMs] backoff = base * attempt + jitter(0..base)
 * @returns {Promise<T>}
 */
async function runTransactionWithRetry(fn, options = {}) {
  const {
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    client = prisma,
    wait = sleep,
  } = options;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.$transaction(fn);
    } catch (error) {
      if (!isTransactionConflict(error)) throw error;
      if (attempt >= maxAttempts) {
        throw AppError.conflict('The request conflicted with a concurrent update. Please try again');
      }
      // Jitter để hai transaction vừa đụng nhau không chạy lại cùng nhịp.
      await wait(baseDelayMs * attempt + Math.floor(Math.random() * baseDelayMs));
    }
  }
}

module.exports = { isTransactionConflict, runTransactionWithRetry };
