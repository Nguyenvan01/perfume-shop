'use strict';

const { prisma } = require('../../config/database');
const { USER_PUBLIC_SELECT } = require('../auth/auth.constant');

/** Soft delete: mọi query đều loại user đã xóa. */
const notDeleted = { deleted_at: null };

function buildWhere({ q, role, status }) {
  const where = { ...notDeleted };

  if (q) {
    where.OR = [{ email: { contains: q } }, { full_name: { contains: q } }, { phone: { contains: q } }];
  }
  if (status) where.status = status;
  if (role) where.user_roles = { some: { role: { name: role } } };

  return where;
}

async function findMany({ filters, skip, take, orderBy }) {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take, orderBy, select: USER_PUBLIC_SELECT }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}

const findById = (id) =>
  prisma.user.findFirst({ where: { id, ...notDeleted }, select: USER_PUBLIC_SELECT });

const findByEmail = (email) => prisma.user.findFirst({ where: { email, ...notDeleted } });

const findRolesByIds = (ids) => prisma.role.findMany({ where: { id: { in: ids } } });

/** Tạo user + gán role trong 1 transaction; nếu có role CUSTOMER thì tạo luôn profile + cart. */
const create = ({ email, password_hash, full_name, phone, role_ids, roleNames }) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, password_hash, full_name, phone },
      select: { id: true },
    });

    await tx.userRole.createMany({
      data: role_ids.map((role_id) => ({ user_id: user.id, role_id })),
    });

    if (roleNames.includes('CUSTOMER')) {
      const customer = await tx.customer.create({ data: { user_id: user.id } });
      await tx.cart.create({ data: { customer_id: customer.id } });
    }

    // Đọc lại SAU khi gán role, nếu không user_roles trả về rỗng.
    return tx.user.findUnique({ where: { id: user.id }, select: USER_PUBLIC_SELECT });
  });

/** Cập nhật thông tin + thay toàn bộ role (nếu truyền role_ids). */
const update = (id, { data, role_ids }) =>
  prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id }, data });
    }
    if (role_ids) {
      await tx.userRole.deleteMany({ where: { user_id: id } });
      await tx.userRole.createMany({ data: role_ids.map((role_id) => ({ user_id: id, role_id })) });
    }
    return tx.user.findUnique({ where: { id }, select: USER_PUBLIC_SELECT });
  });

/** Khóa user → thu hồi hết refresh token để session đang mở chết ngay. */
const setStatus = (id, status) =>
  prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data: { status }, select: USER_PUBLIC_SELECT });
    if (status === 'LOCKED') {
      await tx.refreshToken.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    }
    return user;
  });

const updatePasswordHash = (id, password_hash) =>
  prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { password_hash } });
    await tx.refreshToken.updateMany({
      where: { user_id: id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });

const softDelete = (id) =>
  prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { deleted_at: new Date(), status: 'LOCKED' } });
    await tx.refreshToken.updateMany({
      where: { user_id: id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });

module.exports = {
  findMany,
  findById,
  findByEmail,
  findRolesByIds,
  create,
  update,
  setStatus,
  updatePasswordHash,
  softDelete,
};
