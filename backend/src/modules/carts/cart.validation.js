'use strict';

const { z } = require('../../utils/validation');

const itemIdParam = z.object({
  itemId: z.coerce.number().int().positive({ message: 'itemId must be a positive integer' }),
});

const quantity = z.coerce
  .number()
  .int()
  .positive({ message: 'quantity must be > 0' })
  .max(1000, { message: 'quantity is too large' });

const addItemSchema = {
  body: z.object({
    variant_id: z.coerce.number().int().positive({ message: 'variant_id is required' }),
    quantity,
  }),
};

const updateItemSchema = { params: itemIdParam, body: z.object({ quantity }) };

const itemParamSchema = { params: itemIdParam };

const previewSchema = {
  body: z.object({
    promotion_code: z.string().trim().max(50).toUpperCase().optional(),
  }),
};

module.exports = { addItemSchema, updateItemSchema, itemParamSchema, previewSchema };
