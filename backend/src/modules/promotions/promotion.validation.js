'use strict';

const { z, idParam, paginationQuery } = require('../../utils/validation');

const code = z
  .string()
  .trim()
  .min(3, { message: 'Code is too short' })
  .max(50)
  .toUpperCase()
  .regex(/^[A-Z0-9_-]+$/, { message: 'Code may contain A-Z, 0-9, _ and - only' });

const money = z.coerce.number().nonnegative().max(999_999_999);

const validateSchema = {
  body: z.object({
    code: z.string().trim().min(1, { message: 'Promotion code is required' }).max(50).toUpperCase(),
    subtotal: z.coerce.number().nonnegative({ message: 'subtotal must be >= 0' }),
  }),
};

const listSchema = {
  query: paginationQuery.extend({
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    active_only: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  }),
};

const detailSchema = { params: idParam };

const baseBody = z.object({
  code,
  name: z.string().trim().min(3, { message: 'Name is too short' }).max(150),
  discount_type: z.enum(['PERCENTAGE', 'FIXED']),
  discount_value: z.coerce.number().positive({ message: 'discount_value must be > 0' }),
  minimum_order_value: money.optional(),
  max_discount: money.nullable().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  usage_limit: z.coerce.number().int().positive().nullable().optional(),
  per_customer_limit: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const createSchema = {
  body: baseBody
    .refine((data) => data.end_date > data.start_date, {
      message: 'end_date must be after start_date',
      path: ['end_date'],
    })
    .refine(
      (data) =>
        data.discount_type !== 'PERCENTAGE' ||
        (data.discount_value > 0 && data.discount_value <= 100),
      { message: 'PERCENTAGE discount_value must be between 1 and 100', path: ['discount_value'] }
    )
    .refine(
      // max_discount chỉ có nghĩa với giảm theo phần trăm.
      (data) => data.discount_type === 'PERCENTAGE' || data.max_discount == null,
      { message: 'max_discount only applies to PERCENTAGE discounts', path: ['max_discount'] }
    ),
};

const updateSchema = {
  params: idParam,
  // Partial: so sánh chéo start/end và kiểm tra PERCENTAGE làm ở service,
  // vì cần biết giá trị đang lưu trong DB.
  body: baseBody.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'No field to update',
  }),
};

const setStatusSchema = {
  params: idParam,
  body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }),
};

module.exports = {
  validateSchema,
  listSchema,
  detailSchema,
  createSchema,
  updateSchema,
  setStatusSchema,
};
