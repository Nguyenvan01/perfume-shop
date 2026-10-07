'use strict';

const { prisma } = require('../../config/database');

const ROLE_SELECT = {
  id: true,
  name: true,
  description: true,
  is_system: true,
  created_at: true,
  role_permissions: { select: { permission: { select: { id: true, code: true } } } },
  _count: { select: { user_roles: true } },
};

const findAll = () => prisma.role.findMany({ orderBy: { id: 'asc' }, select: ROLE_SELECT });

const findById = (id) => prisma.role.findUnique({ where: { id }, select: ROLE_SELECT });

const findByName = (name) => prisma.role.findUnique({ where: { name } });

const findPermissionsByIds = (ids) => prisma.permission.findMany({ where: { id: { in: ids } } });

const findAllPermissions = () =>
  prisma.permission.findMany({
    orderBy: { code: 'asc' },
    select: { id: true, code: true, description: true },
  });

const create = ({ name, description, permission_ids }) =>
  prisma.$transaction(async (tx) => {
    const role = await tx.role.create({ data: { name, description } });
    if (permission_ids?.length) {
      await tx.rolePermission.createMany({
        data: permission_ids.map((permission_id) => ({ role_id: role.id, permission_id })),
      });
    }
    return tx.role.findUnique({ where: { id: role.id }, select: ROLE_SELECT });
  });

/** Thay toàn bộ permission của role (không merge) — admin thấy đúng cái mình chọn. */
const update = (id, { description, permission_ids }) =>
  prisma.$transaction(async (tx) => {
    if (description !== undefined) {
      await tx.role.update({ where: { id }, data: { description } });
    }
    if (permission_ids) {
      await tx.rolePermission.deleteMany({ where: { role_id: id } });
      if (permission_ids.length) {
        await tx.rolePermission.createMany({
          data: permission_ids.map((permission_id) => ({ role_id: id, permission_id })),
        });
      }
    }
    return tx.role.findUnique({ where: { id }, select: ROLE_SELECT });
  });

const remove = (id) => prisma.role.delete({ where: { id } });

module.exports = {
  findAll,
  findById,
  findByName,
  findPermissionsByIds,
  findAllPermissions,
  create,
  update,
  remove,
};
