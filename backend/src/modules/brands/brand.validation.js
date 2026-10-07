'use strict';

const { z, idParam, paginationQuery } = require('../../utils/validation');

const statusEnum = z.enum(['ACTIVE', 'INACTIVE']);

const listSchema = { query: paginationQuery.extend({ status: statusEnum.optional() }) };

const detailSchema = { params: idParam };

const createSchema = {
  body: z.object({
    name: z.string().trim().min(1, { message: 'Name is required' }).max(120),
    slug: z.string().trim().max(140).optional(),
    description: z.string().trim().max(5000).optional(),
    logo_url: z.string().trim().url({ message: 'logo_url must be a valid URL' }).max(500).optional(),
    status: statusEnum.optional(),
  }),
};

const updateSchema = {
  params: idParam,
  body: createSchema.body.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'No field to update',
  }),
};

module.exports = { listSchema, detailSchema, createSchema, updateSchema };
