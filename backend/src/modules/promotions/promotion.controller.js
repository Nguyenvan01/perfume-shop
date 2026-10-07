'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok, created, paginated, noContent } = require('../../utils/response');
const service = require('./promotion.service');

/** Khách nhập mã ở giỏ hàng để xem trước tiền giảm. */
const validate = asyncHandler(async (req, res) => {
  const { promotion, discount_amount } = await service.validateForUser({
    code: req.body.code,
    subtotal: req.body.subtotal,
    userId: req.user.id,
  });

  return ok(
    res,
    { valid: true, promotion: service.toPromotionDTO(promotion), discount_amount },
    'Promotion code is valid'
  );
});

const list = asyncHandler(async (req, res) => paginated(res, await service.list(req.query)));

const detail = asyncHandler(async (req, res) => ok(res, await service.detail(req.params.id)));

const create = asyncHandler(async (req, res) =>
  created(res, await service.create(req.body), 'Promotion created')
);

const update = asyncHandler(async (req, res) =>
  ok(res, await service.update(req.params.id, req.body), 'Promotion updated')
);

const setStatus = asyncHandler(async (req, res) =>
  ok(res, await service.setStatus(req.params.id, req.body.status), 'Status updated')
);

const remove = asyncHandler(async (req, res) => {
  await service.remove(req.params.id);
  return noContent(res, 'Promotion deleted');
});

module.exports = { validate, list, detail, create, update, setStatus, remove };
