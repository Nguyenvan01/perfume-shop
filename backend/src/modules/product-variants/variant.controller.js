'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/response');
const service = require('./variant.service');

const listByProduct = asyncHandler(async (req, res) =>
  ok(res, await service.listByProduct(req.params.productId))
);

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.params.productId, req.body), 'Variant created')
);

const detail = asyncHandler(async (req, res) => ok(res, await service.detail(req.params.id)));

const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'Variant updated')
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Variant deleted');
});

module.exports = { listByProduct, create, detail, update, remove };
