'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/response');
const service = require('./role.service');

const list = asyncHandler(async (_req, res) => ok(res, await service.list()));
const detail = asyncHandler(async (req, res) => ok(res, await service.detail(req.params.id)));
const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.body), 'Role created')
);
const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'Role updated')
);
const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Role deleted');
});
const listPermissions = asyncHandler(async (_req, res) => ok(res, await service.listPermissions()));

module.exports = { list, detail, create, update, remove, listPermissions };
