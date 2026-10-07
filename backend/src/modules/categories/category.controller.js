'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/response');
const service = require('./category.service');

const isPublicRequest = (req) => !req.user?.roles?.some((r) => ['ADMIN', 'STAFF'].includes(r));

const list = asyncHandler(async (req, res) =>
  paginated(res, await service.list(req.query, { publicOnly: isPublicRequest(req) }))
);

const detail = asyncHandler(async (req, res) =>
  ok(res, await service.detail(req.params.id, { publicOnly: isPublicRequest(req) }))
);

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.body), 'Category created')
);

const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'Category updated')
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Category deleted');
});

module.exports = { list, detail, create, update, remove };
