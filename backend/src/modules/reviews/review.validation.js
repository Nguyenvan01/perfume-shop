'use strict';

const { z, idParam, paginationQuery } = require('../../utils/validation');

const productIdParam = z.object({
  productId: z.coerce.number().int().positive({ message: 'productId must be a positive integer' }),
});

const rating = z.coerce
  .number()
  .int()
  .min(1, { message: 'Rating must be between 1 and 5' })
  .max(5, { message: 'Rating must be between 1 and 5' });

const comment = z.string().trim().max(2000).optional();

const listByProductSchema = {
  params: productIdParam,
  query: paginationQuery.extend({ rating: rating.optional() }),
};

const eligibilitySchema = { params: productIdParam };

const createSchema = {
  params: productIdParam,
  body: z.object({ rating, comment }),
};

const updateSchema = {
  params: idParam,
  body: z
    .object({ rating: rating.optional(), comment })
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const listAllSchema = {
  query: paginationQuery.extend({
    product_id: z.coerce.number().int().positive().optional(),
    rating: rating.optional(),
    is_hidden: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  }),
};

const visibilitySchema = {
  params: idParam,
  body: z.object({ is_hidden: z.boolean() }),
};

const detailSchema = { params: idParam };

module.exports = {
  listByProductSchema,
  eligibilitySchema,
  createSchema,
  updateSchema,
  listAllSchema,
  visibilitySchema,
  detailSchema,
};
