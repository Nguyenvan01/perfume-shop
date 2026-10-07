'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/response');
const service = require('./review.service');

const listByProduct = asyncHandler(async (req, res) => {
  const result = await service.listByProduct(req.params.productId, req.query);
  // Gửi kèm summary cùng response list để trang sản phẩm chỉ cần 1 request.
  return res.status(200).json({
    success: true,
    message: 'Success',
    data: result.items,
    meta: result.meta,
    summary: result.summary,
  });
});

const eligibility = asyncHandler(async (req, res) =>
  ok(res, await service.eligibility(req.user.id, req.params.productId))
);

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.user.id, req.params.productId, req.body), 'Review submitted')
);

const update = asyncHandler(async (req, res) =>
  ok(res, await service.updateOwn(req.user.id, req.params.id, req.body), 'Review updated')
);

const listAll = asyncHandler(async (req, res) => paginated(res, await service.listAll(req.query)));

const setVisibility = asyncHandler(async (req, res) =>
  ok(
    res,
    await service.setVisibility(req.params.id, req.body.is_hidden),
    req.body.is_hidden ? 'Review hidden' : 'Review shown'
  )
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Review deleted');
});

module.exports = { listByProduct, eligibility, create, update, listAll, setVisibility, remove };
