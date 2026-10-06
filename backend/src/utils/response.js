'use strict';

/**
 * Envelope thống nhất cho mọi response (implementation_plan.md §2).
 * `meta` chỉ xuất hiện ở list endpoint.
 */
function send(res, statusCode, data, message, meta) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

const ok = (res, data = null, message = 'Success', meta) => send(res, 200, data, message, meta);

const created = (res, data = null, message = 'Created') => send(res, 201, data, message);

/** List response: data là array, meta là thông tin phân trang. */
const paginated = (res, { items, meta }, message = 'Success') => send(res, 200, items, message, meta);

const noContent = (res, message = 'Success') => send(res, 200, null, message);

module.exports = { ok, created, paginated, noContent };
