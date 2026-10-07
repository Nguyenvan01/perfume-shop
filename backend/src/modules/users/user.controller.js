'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/response');
const service = require('./user.service');

const list = asyncHandler(async (req, res) => paginated(res, await service.list(req.query)));

const detail = asyncHandler(async (req, res) => ok(res, await service.detail(req.params.id)));

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.body), 'User created')
);

const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'User updated')
);

const setStatus = asyncHandler(async (req, res) =>
  ok(res, await service.setStatus(req.params.id, req.body.status, req.user.id), 'Status updated')
);

const resetPassword = asyncHandler(async (req, res) => {
  await service.resetPassword(req.params.id, req.body.new_password);
  return noContent(res, 'Password reset successfully');
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id, req.user.id);
  return noContent(res, 'User deleted');
});

module.exports = { list, detail, create, update, setStatus, resetPassword, remove };
