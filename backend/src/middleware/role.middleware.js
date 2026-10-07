'use strict';

const AppError = require('../utils/AppError');
const { prisma } = require('../config/database');

/**
 * Chặn theo role. Phải đặt SAU authenticate.
 * Frontend cũng ẩn menu, nhưng đây mới là chốt thật (CLAUDE.md §3).
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) return next(AppError.forbidden());
    return next();
  };
}

/** Chặn theo permission code. Nạp permission từ DB (không nhúng vào token). */
function requirePermission(code) {
  return async (req, _res, next) => {
    try {
      if (!req.user) throw AppError.unauthorized();

      if (!req.user.permissions) {
        const rows = await prisma.rolePermission.findMany({
          where: { role: { user_roles: { some: { user_id: req.user.id } } } },
          select: { permission: { select: { code: true } } },
        });
        req.user.permissions = [...new Set(rows.map((row) => row.permission.code))];
      }

      if (!req.user.permissions.includes(code)) throw AppError.forbidden();
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { requireRole, requirePermission };
