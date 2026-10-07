'use strict';

const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../utils/jwt');
const { prisma } = require('../config/database');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Bắt buộc đăng nhập. Gắn req.user = { id, email, roles }.
 * Kiểm tra lại user trong DB để token của user vừa bị khóa/xóa không còn dùng được.
 */
async function authenticate(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw AppError.unauthorized('Missing access token');

    const payload = verifyAccessToken(token);

    const user = await prisma.user.findFirst({
      where: { id: payload.sub, deleted_at: null },
      select: { id: true, email: true, status: true },
    });

    if (!user) throw AppError.unauthorized('User no longer exists');
    if (user.status === 'LOCKED') throw AppError.forbidden('Account is locked');

    req.user = { id: user.id, email: user.email, roles: payload.roles || [] };
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Gắn req.user nếu có token dùng được, nhưng KHÔNG chặn request.
 * Token thiếu / hết hạn / của user bị khóa đều bị bỏ qua im lặng — endpoint
 * public (danh sách sản phẩm…) không được 401 chỉ vì access token vừa hết hạn.
 */
async function optionalAuthenticate(req, res, next) {
  if (!extractToken(req)) return next();
  return authenticate(req, res, () => next());
}

module.exports = { authenticate, optionalAuthenticate };
