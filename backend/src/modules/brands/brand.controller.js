'use strict';

const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/response');
const service = require('./brand.service');

/** Request không mang token hợp lệ của ADMIN/STAFF thì chỉ được thấy bản ghi ACTIVE. */
const isPublicRequest = (req) => !req.user?.roles?.some((r) => ['ADMIN', 'STAFF'].includes(r));

const list = asyncHandler(async (req, res) =>
  paginated(res, await service.list(req.query, { publicOnly: isPublicRequest(req) }))
);

const detail = asyncHandler(async (req, res) =>
  ok(res, await service.detail(req.params.id, { publicOnly: isPublicRequest(req) }))
);

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.body), 'Brand created')
);

const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'Brand updated')
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Brand deleted');
});

const uploadLogo = asyncHandler(async (req, res) => {
  const file = req.files?.[0];
  if (!file) throw AppError.badRequest('No file uploaded. Use field "files"');
  return ok(res, await service.uploadLogo(req.params.id, file), 'Logo uploaded');
});

module.exports = { list, detail, create, update, remove, uploadLogo };
