'use strict';

const { z, idParam } = require('../../utils/validation');

const permissionIds = z.array(z.coerce.number().int().positive());

const createSchema = {
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[A-Z_]+$/, { message: 'Role name must be UPPER_SNAKE_CASE' }),
    description: z.string().trim().max(255).optional(),
    permission_ids: permissionIds.optional(),
  }),
};

const updateSchema = {
  params: idParam,
  body: z
    .object({
      description: z.string().trim().max(255).optional(),
      permission_ids: permissionIds.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const detailSchema = { params: idParam };

module.exports = { createSchema, updateSchema, detailSchema };
