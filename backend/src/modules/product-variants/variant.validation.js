'use strict';

const { z, idParam } = require('../../utils/validation');
const { variantInput } = require('../products/product.validation');

const productIdParam = z.object({
  productId: z.coerce.number().int().positive({ message: 'productId must be a positive integer' }),
});

const listSchema = { params: productIdParam };

const createSchema = { params: productIdParam, body: variantInput };

const updateSchema = {
  params: idParam,
  // Partial nên bỏ refine của variantInput; so sánh sale_price/price làm ở service
  // vì cần biết giá hiện tại trong DB.
  body: variantInput
    .innerType()
    .partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const detailSchema = { params: idParam };

module.exports = { listSchema, createSchema, updateSchema, detailSchema };
