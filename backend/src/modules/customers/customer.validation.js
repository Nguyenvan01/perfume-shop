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

const listSchema = {
  query: paginationQuery.extend({ status: z.enum(['ACTIVE', 'LOCKED']).optional() }),
};

const detailSchema = { params: idParam };

const ordersSchema = {
  params: idParam,
  query: paginationQuery.extend({ status: orderStatusEnum.optional() }),
};

const setStatusSchema = {
  params: idParam,
  body: z.object({ status: z.enum(['ACTIVE', 'LOCKED']) }),
};

module.exports = { listSchema, detailSchema, ordersSchema, setStatusSchema };
