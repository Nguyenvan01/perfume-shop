'use strict';

const { prisma } = require('../../config/database');
const { USER_PUBLIC_SELECT } = require('./auth.constant');

const findUserByEmail = (email) =>
  prisma.user.findFirst({
    where: { email, deleted_at: null },
    select: { ...USER_PUBLIC_SELECT, password_hash: true },
  });

const findUserById = (id) =>
  prisma.user.findFirst({ where: { id, deleted_at: null }, select: USER_PUBLIC_SELECT });

const findUserWithPassword = (id) =>
  prisma.user.findFirst({
    where: { id, deleted_at: null },
    select: { id: true, password_hash: true },
  });

const findRoleByName = (name) => prisma.role.findUnique({ where: { name } });

const findCustomerByUserId = (user_id) => prisma.customer.findUnique({ where: { user_id } });

const findPermissionCodes = async (user_id) => {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { user_roles: { some: { user_id } } } },
    select: { permission: { select: { code: true } } },
  });
  return [...new Set(rows.map((row) => row.permission.code))];
};

/**
 * Đăng ký: user + gán role + profile customer + cart phải xong hoặc fail cùng nhau,
 * không để lại user không có cart (OD-2).
 */
const createCustomerAccount = ({ email, password_hash, full_name, phone, address, role_id }) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, password_hash, full_name, phone },
      select: { id: true },
    });

    await tx.userRole.create({ data: { user_id: user.id, role_id } });

    const customer = await tx.customer.create({ data: { user_id: user.id, address } });
    await tx.cart.create({ data: { customer_id: customer.id } });

    // Đọc lại SAU khi gán role — select trước đó sẽ trả user_roles rỗng,
    // khiến access token phát ra không có role nào.
    return tx.user.findUnique({ where: { id: user.id }, select: USER_PUBLIC_SELECT });
  });

const updateUserProfile = (id, data) =>
  prisma.user.update({ where: { id }, data, select: USER_PUBLIC_SELECT });

const updatePasswordHash = (id, password_hash) =>
  prisma.user.update({ where: { id }, data: { password_hash } });

// ─── Refresh token ───

const createRefreshToken = ({ user_id, token_hash, expires_at }) =>
  prisma.refreshToken.create({ data: { user_id, token_hash, expires_at } });

const findRefreshToken = (token_hash) =>
  prisma.refreshToken.findUnique({ where: { token_hash } });

const revokeRefreshToken = (id) =>
  prisma.refreshToken.update({ where: { id }, data: { revoked_at: new Date() } });

/** Dùng khi phát hiện token đã revoke bị dùng lại → thu hồi toàn bộ session. */
const revokeAllRefreshTokens = (user_id) =>
  prisma.refreshToken.updateMany({
    where: { user_id, revoked_at: null },
    data: { revoked_at: new Date() },
  });

// ─── Reset password token ───

const createResetToken = ({ user_id, token_hash, expires_at }) =>
  prisma.passwordResetToken.create({ data: { user_id, token_hash, expires_at } });

const findResetToken = (token_hash) =>
  prisma.passwordResetToken.findUnique({ where: { token_hash } });

const markResetTokenUsed = (id) =>
  prisma.passwordResetToken.update({ where: { id }, data: { used_at: new Date() } });

const updateCustomerAddress = (user_id, address) =>
  prisma.customer.update({ where: { user_id }, data: { address } });

module.exports = {
  findUserByEmail,
  findUserById,
  findUserWithPassword,
  findRoleByName,
  findCustomerByUserId,
  findPermissionCodes,
  createCustomerAccount,
  updateUserProfile,
  updatePasswordHash,
  createRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokens,
  createResetToken,
  findResetToken,
  markResetTokenUsed,
  updateCustomerAddress,
};
