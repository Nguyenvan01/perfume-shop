'use strict';

const { z, idParam, paginationQuery } = require('../../utils/validation');

const orderStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'PACKING',
  'SHIPPING',
  'COMPLETED',
  'CANCELLED',
  'RETURNED',
]);

const createSchema = {
  body: z.object({
    receiver_name: z.string().trim().min(2, { message: 'Receiver name is too short' }).max(120),
    receiver_phone: z
      .string()
      .trim()
      .regex(/^0\d{8,10}$/, { message: 'Receiver phone is invalid' }),
    shipping_address: z
      .string()
      .trim()
      .min(5, { message: 'Shipping address is too short' })
      .max(255),
    note: z.string().trim().max(255).optional(),
    promotion_code: z.string().trim().max(50).toUpperCase().optional(),
    payment_method: z.enum(['COD', 'BANK_TRANSFER']),
  }),
};

const myOrdersSchema = {
  query: paginationQuery.extend({ status: orderStatusEnum.optional() }),
};

const listSchema = {
  query: paginationQuery.extend({
    status: orderStatusEnum.optional(),
    customer_id: z.coerce.number().int().positive().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
};

const detailSchema = { params: idParam };

const changeStatusSchema = {
  params: idParam,
  body: z.object({
    status: orderStatusEnum,
    note: z.string().trim().max(255).optional(),
  }),
};

const cancelSchema = {
  params: idParam,
  body: z.object({
    reason: z.string().trim().min(3, { message: 'Cancel reason is required' }).max(255),
  }),
};

const returnSchema = {
  params: idParam,
  body: z.object({
    reason: z.string().trim().min(3, { message: 'Return reason is required' }).max(255),
  }),
};

const paymentSchema = {
  params: idParam,
  body: z.object({ status: z.enum(['UNPAID', 'PAID', 'REFUNDED']) }),
};

module.exports = {
  createSchema,
  myOrdersSchema,
  listSchema,
  detailSchema,
  changeStatusSchema,
  cancelSchema,
  returnSchema,
  paymentSchema,
};
