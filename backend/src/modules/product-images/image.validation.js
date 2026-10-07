'use strict';

const { z } = require('../../utils/validation');

const productIdParam = z.object({
  productId: z.coerce.number().int().positive({ message: 'productId must be a positive integer' }),
});

const listSchema = { params: productIdParam };

const uploadSchema = {
  params: productIdParam,
  // multipart: mọi field là string nên dùng enum thay vì boolean.
  body: z.object({ is_primary: z.enum(['true', 'false']).optional() }).passthrough(),
};

const imageParamSchema = {
  params: productIdParam.extend({
    imageId: z.coerce.number().int().positive({ message: 'imageId must be a positive integer' }),
  }),
};

module.exports = { listSchema, uploadSchema, imageParamSchema };
