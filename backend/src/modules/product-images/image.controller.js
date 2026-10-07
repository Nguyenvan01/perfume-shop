'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, noContent } = require('../../utils/response');
const service = require('./image.service');

const listByProduct = asyncHandler(async (req, res) =>
  ok(res, await service.listByProduct(req.params.productId))
);

const upload = asyncHandler(async (req, res) =>
  created(
    res,
    await service.upload(req.params.productId, req.files, {
      isPrimary: req.body?.is_primary === 'true',
    }),
    'Images uploaded'
  )
);

const setPrimary = asyncHandler(async (req, res) =>
  ok(res, await service.setPrimary(req.params.productId, req.params.imageId), 'Primary image updated')
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.productId, req.params.imageId);
  return noContent(res, 'Image deleted');
});

module.exports = { listByProduct, upload, setPrimary, remove };
