'use strict';

const AppError = require('../../utils/AppError');
const repo = require('./role.repository');

function toRoleDTO(role) {
  if (!role) return null;
  const { role_permissions, _count, ...rest } = role;
  return {
    ...rest,
    permissions: role_permissions.map((item) => item.permission.code),
    permission_ids: role_permissions.map((item) => item.permission.id),
    user_count: _count?.user_roles ?? 0,
  };
}

const list = async () => (await repo.findAll()).map(toRoleDTO);

async function detail(id) {
  const role = await repo.findById(id);
  if (!role) throw AppError.notFound('Role not found');
  return toRoleDTO(role);
}

async function assertPermissionsExist(permission_ids) {
  if (!permission_ids?.length) return;
  const found = await repo.findPermissionsByIds(permission_ids);
  if (found.length !== permission_ids.length) {
    throw AppError.badRequest('One or more permission_ids do not exist');
  }
}

async function create({ name, description, permission_ids }) {
  if (await repo.findByName(name)) throw AppError.conflict('Role name already exists');
  await assertPermissionsExist(permission_ids);
  return toRoleDTO(await repo.create({ name, description, permission_ids }));
}

async function update(id, { description, permission_ids }) {
  await detail(id);
  await assertPermissionsExist(permission_ids);
  return toRoleDTO(await repo.update(id, { description, permission_ids }));
}

async function remove(id) {
  const role = await detail(id);

  // 3 role lõi là nền của phân quyền — xóa đi là hỏng toàn hệ thống.
  if (role.is_system) throw AppError.conflict('System role cannot be deleted');
  if (role.user_count > 0) throw AppError.conflict('Role is still assigned to users');

  await repo.remove(id);
}

const listPermissions = () => repo.findAllPermissions();

module.exports = { toRoleDTO, list, detail, create, update, remove, listPermissions };
