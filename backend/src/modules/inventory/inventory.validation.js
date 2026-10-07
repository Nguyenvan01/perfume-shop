'use strict';

const { z, paginationQuery } = require('../../utils/validation');

const variantId = z.coerce.number().int().positive();
const quantity = z.coerce.number().int().positive({ message: 'quantity must be > 0' }).max(1_000_000);

const movementItems = z
  .array(
    z.object({
      variant_id: variantId,
      quantity,
      note: z.string().trim().max(255).optional(),
    })
  )
  .min(1, { message: 'At least one item is required' })
  .max(100);

const boolFlag = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

const listSchema = {
  query: paginationQuery.extend({
    brand_id: variantId.optional(),
    category_id: variantId.optional(),
    low_stock: boolFlag,
    out_of_stock: boolFlag,
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
};

const movementSchema = {
  body: z.object({ items: movementItems, note: z.string().trim().max(255).optional() }),
};

const adjustmentSchema = {
  body: z.object({
    variant_id: variantId,
    new_quantity: z.coerce.number().int().min(0, { message: 'new_quantity must be >= 0' }).max(1_000_000),
    // Điều chỉnh kho luôn phải có lý do để đối chiếu khi kiểm kê.
    note: z.string().trim().min(3, { message: 'note is required for stock adjustment' }).max(255),
  }),
};

const transactionsSchema = {
  query: paginationQuery.extend({
    variant_id: variantId.optional(),
    type: z.enum(['IMPORT', 'EXPORT', 'SALE', 'RETURN', 'ADJUSTMENT']).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
};

module.exports = { listSchema, movementSchema, adjustmentSchema, transactionsSchema };
