'use strict';

const { z } = require('../../utils/validation');
const { RANGES } = require('../../utils/dateRange');

/** Mọi endpoint báo cáo dùng chung bộ query này. */
const rangeQuery = z.object({
  range: z.enum(RANGES).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const rangeSchema = { query: rangeQuery };

const revenueSchema = {
  query: rangeQuery.extend({ group_by: z.enum(['day', 'month']).optional() }),
};

const limitSchema = {
  query: rangeQuery.extend({ limit: z.coerce.number().int().min(1).max(50).optional() }),
};

module.exports = { rangeSchema, revenueSchema, limitSchema };
