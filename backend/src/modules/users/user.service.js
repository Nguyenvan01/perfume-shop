'use strict';

const bcrypt = require('bcryptjs');
const AppError = require('../../utils/AppError');
const { parsePagination, buildPaginatedResult } = require('../../utils/pagination');
const { BCRYPT_ROUNDS } = require('../auth/auth.constant');
const { toUserDTO } = require('../auth/auth.service');
const repo = require('./user.repository');

const SORTABLE = ['created_at', 'email', 'full_name', 'status'];

async function list(query) {
  const { page, limit, skip, take, orderBy } = parsePagination(query, {
    allowedSortFields: SORTABLE,
  });

  const { items, total } = await repo.findMany({
    filters: { q: query.q, role: query.role, status: query.status },
    skip,
    take,
    orderBy,
  });

  return buildPaginatedResult(items.map(toUserDTO), total, { page, limit });
}

async function detail(id) {
  const user = await repo.findById(id);
  if (!user) throw AppError.notFound('User not found');
  return toUserDTO(user);
}

/** Role phải tồn tại đủ — tránh gán role_id rác rồi user không có quyền nào. */
async function resolveRoles(role_ids) {
  const roles = await repo.findRolesByIds(role_ids);
  if (roles.length !== role_ids.length) {
    throw AppError.badRequest('One or more role_ids do not exist');
  }
  return roles;
}

async function create({ email, password, full_name, phone, role_ids }) {
  if (await repo.findByEmail(email)) throw AppError.conflict('Email already registered');

  const roles = await resolveRoles(role_ids);

  const user = await repo.create({
    email,
    password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    full_name,
    phone,
    role_ids,
    roleNames: roles.map((role) => role.name),
  });

  return toUserDTO(user);
}

async function update(id, { full_name, phone, role_ids }) {
  await detail(id);

  const data = {};
  if (full_name !== undefined) data.full_name = full_name;
  if (phone !== undefined) data.phone = phone;

  if (role_ids) await resolveRoles(role_ids);

  const user = await repo.update(id, { data, role_ids });
  return toUserDTO(user);
}

async function setStatus(id, status, actorId) {
  // Tự khóa chính mình sẽ tự đẩy mình ra khỏi hệ thống → chặn.
  if (id === actorId) throw AppError.conflict('You cannot change your own status');
  await detail(id);
  return toUserDTO(await repo.setStatus(id, status));
}

async function resetPassword(id, newPassword) {
  await detail(id);
  await repo.updatePasswordHash(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

async function remove(id, actorId) {
  if (id === actorId) throw AppError.conflict('You cannot delete your own account');
  await detail(id);
  await repo.softDelete(id);
}

module.exports = { list, detail, create, update, setStatus, resetPassword, remove };
