'use strict';

const { z, idParam, paginationQuery } = require('../../utils/validation');

const statusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const genderEnum = z.enum(['MALE', 'FEMALE', 'UNISEX']);
const concentrationEnum = z.enum(['EDC', 'EDT', 'EDP', 'PARFUM']);

const money = z.coerce
  .number({ message: 'Price must be a number' })
  .nonnegative({ message: 'Price must be >= 0' })
  .max(999_999_999);

const variantInput = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, { message: 'SKU is required' })
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, { message: 'SKU may contain letters, digits, . _ - only' }),
    volume_ml: z.coerce.number().int().positive({ message: 'volume_ml must be > 0' }).max(10_000),
    price: money,
    sale_price: money.optional().nullable(),
    status: statusEnum.optional(),
  })
  .refine((data) => data.sale_price == null || data.sale_price <= data.price, {
    message: 'sale_price must not exceed price',
    path: ['sale_price'],
  });

const listSchema = {
  query: paginationQuery
    .extend({
      brand_id: z.coerce.number().int().positive().optional(),
      category_id: z.coerce.number().int().positive().optional(),
      gender: genderEnum.optional(),
      concentration: concentrationEnum.optional(),
      min_price: money.optional(),
      max_price: money.optional(),
      in_stock: z
        .enum(['true', 'false'])
        .transform((value) => value === 'true')
        .optional(),
      status: statusEnum.optional(),
    })
    .refine(
      (data) => data.min_price === undefined || data.max_price === undefined || data.min_price <= data.max_price,
      { message: 'min_price must not exceed max_price', path: ['min_price'] }
    ),
};

/** :id nhận cả số và slug (§2.6) nên không dùng idParam ở đây. */
const detailSchema = {
  params: z.object({ id: z.string().trim().min(1, { message: 'id or slug is required' }) }),
};

const createSchema = {
  body: z.object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
    slug: z.string().trim().max(220).optional(),
    brand_id: z.coerce.number().int().positive({ message: 'brand_id is required' }),
    category_id: z.coerce.number().int().positive({ message: 'category_id is required' }),
    gender: genderEnum,
    origin: z.string().trim().max(100).optional(),
    concentration: concentrationEnum,
    fragrance_family: z.string().trim().max(120).optional(),
    description: z.string().trim().max(10_000).optional(),
    status: statusEnum.optional(),
    variants: z.array(variantInput).max(20).optional(),
  }),
};

const updateSchema = {
  params: idParam,
  // variants không sửa qua đây — có endpoint riêng (§2.7).
  body: createSchema.body
    .omit({ variants: true })
    .partial()
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const deleteSchema = { params: idParam };

module.exports = { listSchema, detailSchema, createSchema, updateSchema, deleteSchema, variantInput };
