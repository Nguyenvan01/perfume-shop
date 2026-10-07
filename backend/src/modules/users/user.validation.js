'use strict';

const { z, idParam, paginationQuery, email, password, fullName, phone } = require('../../utils/validation');

const roleIds = z.array(z.coerce.number().int().positive()).min(1, {
  message: 'At least one role is required',
});

const listSchema = {
  query: paginationQuery.extend({
    role: z.enum(['ADMIN', 'STAFF', 'CUSTOMER']).optional(),
    status: z.enum(['ACTIVE', 'LOCKED']).optional(),
  }),
};

const detailSchema = { params: idParam };

const createSchema = {
  body: z.object({ email, password, full_name: fullName, phone, role_ids: roleIds }),
};

const updateSchema = {
  params: idParam,
  body: z
    .object({ full_name: fullName.optional(), phone, role_ids: roleIds.optional() })
    .refine((data) => Object.keys(data).length > 0, { message: 'No field to update' }),
};

const setStatusSchema = {
  params: idParam,
  body: z.object({ status: z.enum(['ACTIVE', 'LOCKED']) }),
};

const resetPasswordSchema = {
  params: idParam,
  body: z.object({ new_password: password }),
};

module.exports = {
  listSchema,
  detailSchema,
  createSchema,
  updateSchema,
  setStatusSchema,
  resetPasswordSchema,
};
