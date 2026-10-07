'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Access token mang sẵn roles để middleware không phải query DB mỗi request.
 * Permission KHÔNG nhúng vào token (dễ phình + dễ stale) — nạp từ DB khi cần.
 */
function signAccessToken({ id, email, roles }) {
  return jwt.sign({ sub: id, email, roles }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES,
  });
}

function signRefreshToken({ id }) {
  // jti để phân biệt 2 refresh token phát ra cùng giây → hash khác nhau.
  return jwt.sign({ sub: id, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES,
  });
}

const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, env.JWT_REFRESH_SECRET);

/** DB chỉ lưu hash của token — rò rỉ bảng refresh_tokens không cho phép mạo danh. */
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Token dùng 1 lần cho reset password: trả raw cho user, lưu hash. */
function generateOpaqueToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashToken(raw) };
}

/** Đổi "15m" / "7d" / "30s" thành Date hết hạn, để ghi vào DB. */
function expiresAtFrom(duration) {
  const match = /^(\d+)([smhd])$/.exec(String(duration));
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + Number(match[1]) * unitMs[match[2]]);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  generateOpaqueToken,
  expiresAtFrom,
};
