'use strict';

const { z } = require('../../utils/validation');

const validateSchema = {
  body: z.object({
    code: z.string().trim().min(1, { message: 'Promotion code is required' }).max(50).toUpperCase(),
    subtotal: z.coerce.number().nonnegative({ message: 'subtotal must be >= 0' }),
  }),
};

module.exports = { validateSchema };
