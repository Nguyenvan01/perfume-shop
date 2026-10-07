'use strict';

const asyncHandler = require('../../utils/asyncHandler');
const { ok } = require('../../utils/response');
const AppError = require('../../utils/AppError');
const { prisma } = require('../../config/database');
const service = require('./promotion.service');

/** Khách nhập mã ở giỏ hàng để xem trước tiền giảm (CRUD promotion thuộc W6). */
const validate = asyncHandler(async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { user_id: req.user.id } });
  if (!customer) throw AppError.forbidden('Only customer accounts can use promotion codes');

  const { promotion, discount_amount } = await service.validateForCustomer({
    code: req.body.code,
    subtotal: req.body.subtotal,
    customerId: customer.id,
  });

  return ok(
    res,
    { valid: true, promotion: service.toPromotionDTO(promotion), discount_amount },
    'Promotion code is valid'
  );
});

module.exports = { validate };
